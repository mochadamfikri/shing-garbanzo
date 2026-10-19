"""POS V2 — transaksi unit smartphone berbasis IMEI.
MongoDB wajib replica set agar perubahan stok + penjualan bersifat atomik.
"""
import uuid
import hashlib
import json
import logging
from decimal import Decimal, InvalidOperation
from typing import Literal, Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError, PyMongoError

from auth import require_roles, ROLE_OWNER, ROLE_ADMIN, ROLE_STAF
from utils import validate_imei, now_utc

router = APIRouter(prefix="/api/pos", tags=["pos"])
logger = logging.getLogger(__name__)
FINANCE = {ROLE_OWNER, ROLE_ADMIN}


def money(value):
    try:
        d = Decimal(str(value if value is not None else 0))
        if not d.is_finite() or d != d.to_integral_value():
            raise ValueError()
        return int(d)
    except (ValueError, TypeError, InvalidOperation):
        raise HTTPException(422, "Nominal rupiah harus bilangan bulat yang valid")


class SaleItem(BaseModel):
    unit_id: str = Field(min_length=1)
    harga_jual_aktual: Optional[int] = Field(default=None, ge=1)
    diskon: int = Field(default=0, ge=0)
    # Field koreksi modal terbatas jika ada perubahan sebelum jual
    koreksi_modal: Optional[int] = Field(default=None, ge=0)
    alasan_koreksi: Optional[str] = Field(default="", max_length=200)


class SaleRequest(BaseModel):
    items: List[SaleItem] = Field(min_length=1, max_length=50)
    metode_pembayaran: Literal["TUNAI", "TRANSFER", "QRIS_MANUAL"]
    pembayaran_terverifikasi: bool = False
    biaya_transaksi: int = Field(default=0, ge=0)
    pelanggan: Optional[str] = Field(default="", max_length=150)
    catatan: Optional[str] = Field(default="", max_length=500)
    idempotency_key: str = Field(min_length=8, max_length=120)


def public_unit(u, role):
    result = {
        "id": u["id"], "merek": u.get("merek", ""), "model": u.get("model", ""),
        "varian": u.get("varian", ""), "warna": u.get("warna", ""),
        "imei_1": u.get("imei_1", ""), "imei_2": u.get("imei_2", ""),
        "harga_jual": money(u.get("harga_jual")), "status_stok": u.get("status_stok"),
        "foto_utama": next(iter(u.get("foto_urls") or []), None),
        "garansi": u.get("garansi", "")
    }
    if role in FINANCE:
        result["modal"] = sum(money(u.get(k)) for k in ("harga_beli", "biaya_reparasi", "biaya_tambahan"))
    return result


def safe_sale(sale, user):
    doc = {k: v for k, v in sale.items() if k != "_id"}
    doc["items"] = [dict(it) for it in doc.get("items", [])]
    doc.pop("request_fingerprint", None)
    doc.pop("idempotency_key", None)
    if user["role"] not in FINANCE:
        for field in ("hpp", "laba_kotor", "laba_bersih"):
            doc.pop(field, None)
        for it in doc["items"]:
            it.pop("modal", None)
    return doc


@router.get("/lookup")
async def lookup(imei: str = Query(..., min_length=15, max_length=15),
                 user=Depends(require_roles(ROLE_OWNER, ROLE_ADMIN, ROLE_STAF))):
    from server import db
    ok, msg = validate_imei(imei)
    if not ok:
        raise HTTPException(422, msg)
    matches = await db.units.find({"$or": [{"imei_1": imei}, {"imei_2": imei}]}).limit(2).to_list(2)
    if not matches:
        return {"ditemukan": False, "imei": imei,
                "pesan": "IMEI belum ada di database, silakan input data dulu."}
    if len(matches) != 1:
        raise HTTPException(409, "IMEI ganda dalam database. Hubungi Owner.")
    u = public_unit(matches[0], user["role"])
    return {"ditemukan": True, "unit": u, "boleh_dijual": u["status_stok"] == "TERSEDIA",
            "pesan": "Unit tersedia" if u["status_stok"] == "TERSEDIA" else
                     "Unit berstatus " + str(u["status_stok"]) + " dan tidak dapat dijual"}


@router.post("/sales", status_code=201)
async def create_sale(payload: SaleRequest,
                      user=Depends(require_roles(ROLE_OWNER, ROLE_ADMIN, ROLE_STAF))):
    from server import db, client
    key = payload.idempotency_key.strip()
    if len(key) < 8:
        raise HTTPException(422, "Kunci transaksi minimal 8 karakter")
    if not payload.pembayaran_terverifikasi:
        raise HTTPException(400, "Konfirmasi pembayaran sebelum menyelesaikan penjualan")
    if payload.metode_pembayaran != "TUNAI" and user["role"] not in FINANCE:
        raise HTTPException(403, "Verifikasi transfer dan QRIS manual hanya untuk Owner/Admin")
    if any(it.diskon for it in payload.items) and user["role"] not in FINANCE:
        raise HTTPException(403, "Diskon membutuhkan izin Owner/Admin")
    ids = [it.unit_id for it in payload.items]
    if len(set(ids)) != len(ids):
        raise HTTPException(400, "Unit yang sama tidak boleh ditambahkan dua kali")
    fingerprint = hashlib.sha256(json.dumps(payload.model_dump(exclude={"idempotency_key"}),
                                            sort_keys=True).encode()).hexdigest()
    existing = await db.pos_sales.find_one({"idempotency_key": key})
    if existing:
        if existing.get("request_owner") != user["id"] or existing.get("request_fingerprint") != fingerprint:
            raise HTTPException(409, "Kunci transaksi sudah digunakan untuk permintaan berbeda")
        return safe_sale(existing, user)

    now = now_utc().isoformat()
    sale_id = str(uuid.uuid4())
    nomor = f"POS-{now_utc():%Y%m%d}-{sale_id[:8].upper()}"
    sale = None
    try:
        async with await client.start_session() as session:
            async with session.start_transaction():
                lines = []
                subtotal = diskon = hpp = 0
                for item in payload.items:
                    u = await db.units.find_one({"id": item.unit_id}, session=session)
                    if not u:
                        raise HTTPException(404, "Unit tidak ditemukan")
                    if u.get("status_stok") != "TERSEDIA":
                        raise HTTPException(409, f"{u.get('merek', '')} {u.get('model', '')} tidak tersedia (status: {u.get('status_stok')})")
                    
                    # Tentukan harga jual aktual (dari request POS atau harga_jual unit)
                    if item.harga_jual_aktual and item.harga_jual_aktual > 0:
                        harga = item.harga_jual_aktual
                    else:
                        harga = money(u.get("harga_jual"))
                    
                    if harga <= 0:
                        raise HTTPException(400, f"Harga jual aktual untuk {u.get('merek')} {u.get('model')} harus ditentukan dan bernilai > 0")
                    if item.diskon > harga:
                        raise HTTPException(400, "Diskon tidak boleh melebihi harga jual")

                    # Modal snapshot: gunakan modal terkoreksi jika ada
                    if item.koreksi_modal is not None and user["role"] in FINANCE:
                        modal = item.koreksi_modal
                        modal_reparasi = float(u.get("biaya_reparasi") or 0)
                        modal_operasional = float(u.get("biaya_operasional") or 0)
                    else:
                        modal_beli = float(u.get("harga_beli") or 0)
                        modal_reparasi = float(u.get("biaya_reparasi") or 0) if u.get("ada_biaya_reparasi") else 0
                        modal_operasional = float(u.get("biaya_operasional") or 0)
                        modal = int(modal_beli + modal_reparasi + modal_operasional)

                    result = await db.units.update_one(
                        {"id": u["id"], "status_stok": "TERSEDIA"},
                        {"$set": {"status_stok": "TERJUAL", "sold_at": now,
                                  "sale_id": sale_id, "updated_at": now, "harga_jual": harga},
                         "$push": {"history_status": {"status_stok": "TERJUAL", "at": now,
                                                      "oleh": user["email"], "alasan": nomor}}},
                        session=session)
                    if result.modified_count != 1:
                        raise HTTPException(409, "Stok berubah; silakan ulangi transaksi")

                    # Simpan snapshot lengkap spesifikasi unit ke dalam transaksi
                    lines.append({
                        "unit_id": u["id"],
                        "merek": u.get("merek", ""),
                        "model": u.get("model", ""),
                        "varian": u.get("varian", ""),
                        "penyimpanan": u.get("penyimpanan", ""),
                        "warna": u.get("warna", ""),
                        "kondisi": u.get("kondisi", "BEKAS"),
                        "part_number": u.get("part_number", "-"),
                        "model_number": u.get("model_number", "-"),
                        "eid": u.get("eid", "-"),
                        "serial_number": u.get("serial_number", "-"),
                        "imei_1": u.get("imei_1", ""),
                        "imei_2": u.get("imei_2", ""),
                        "imei_masked": "***********" + str(u.get("imei_1", ""))[-4:],
                        "jalur_distributor": u.get("jalur_distributor", "Inter"),
                        "status_sinyal": u.get("status_sinyal", "Sinyal Aman"),
                        "kelengkapan": u.get("kelengkapan", "Fullset"),
                        "addons": u.get("addons", []),
                        "harga_beli": float(u.get("harga_beli") or 0),
                        "biaya_reparasi": modal_reparasi,
                        "biaya_operasional": modal_operasional,
                        "harga_jual": harga,
                        "diskon": item.diskon,
                        "harga_akhir": harga - item.diskon,
                        "modal": modal
                    })
                    subtotal += harga
                    diskon += item.diskon
                    hpp += modal
                net = subtotal - diskon
                sale = {
                    "id": sale_id, "nomor_transaksi": nomor, "kanal": "POS",
                    "request_owner": user["id"], "request_fingerprint": fingerprint,
                    "idempotency_key": key, "kasir_id": user["id"],
                    "kasir": user.get("nama", user["email"]),
                    "items": lines, "jumlah_unit": len(lines),
                    "subtotal": subtotal, "diskon_total": diskon,
                    "penjualan_bersih": net, "hpp": hpp, "biaya_transaksi": payload.biaya_transaksi,
                    "laba_kotor": net - hpp, "laba_bersih": net - hpp - payload.biaya_transaksi,
                    "metode_pembayaran": payload.metode_pembayaran,
                    "status_pembayaran": "DITERIMA", "status": "SELESAI",
                    "pelanggan": (payload.pelanggan or "").strip(),
                    "catatan": (payload.catatan or "").strip(),
                    "tanggal_jual": now, "created_at": now
                }
                await db.pos_sales.insert_one(sale, session=session)
                await db.audit_logs.insert_one({
                    "id": str(uuid.uuid4()), "user_id": user["id"],
                    "user_email": user["email"], "action": "POS_SALE_COMPLETED",
                    "entity": "pos_sale", "entity_id": sale_id,
                    "meta": {"nomor_transaksi": nomor, "jumlah_unit": len(lines)}, "at": now
                }, session=session)
    except DuplicateKeyError:
        prior = await db.pos_sales.find_one({"idempotency_key": key})
        if prior and prior.get("request_owner") == user["id"] and prior.get("request_fingerprint") == fingerprint:
            return safe_sale(prior, user)
        raise HTTPException(409, "Transaksi telah tercatat; tidak diduplikasi")
    except HTTPException:
        raise
    except PyMongoError:
        logger.exception("POS database transaction failed")
        raise HTTPException(503, "Transaksi atomik gagal; cek konfigurasi MongoDB replica set")
    return safe_sale(sale, user)


@router.get("/sales")
async def list_sales(limit: int = Query(50, ge=1, le=200),
                     user=Depends(require_roles(ROLE_OWNER, ROLE_ADMIN, ROLE_STAF))):
    from server import db
    docs = await db.pos_sales.find({}).sort("tanggal_jual", -1).limit(limit).to_list(limit)
    return [safe_sale(doc, user) for doc in docs]


@router.get("/sales/{sale_id}")
async def get_sale(sale_id: str, user=Depends(require_roles(ROLE_OWNER, ROLE_ADMIN, ROLE_STAF))):
    from server import db
    doc = await db.pos_sales.find_one({"id": sale_id})
    if not doc:
        raise HTTPException(404, "Transaksi tidak ditemukan")
    return safe_sale(doc, user)
