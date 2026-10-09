"""Endpoint Pesanan: pelanggan checkout, upload bukti, lihat status.
Admin: list semua pesanan, verifikasi pembayaran, input resi, update status pengiriman."""
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException

from auth import (
    require_roles, ROLE_OWNER, ROLE_ADMIN, ROLE_STAF, ROLE_PELANGGAN,
    STAFF_ROLES,
)
from models_order import (
    CheckoutRequest, OrderPublic, OrderItemSnapshot, OrderAddressSnapshot, OrderMetode,
    UploadBuktiBayarRequest, VerifikasiBayarRequest, UpdateResiRequest,
    STATUS_PENGIRIMAN,
)
from routes_settings import get_settings_internal
from utils import now_utc, format_tanggal_id

router = APIRouter(prefix="/api/orders", tags=["orders"])


def _hold_batas_default() -> datetime:
    return now_utc() + timedelta(minutes=30)


def _generate_nomor() -> str:
    now = now_utc()
    return f"ORD-{now.strftime('%Y%m%d')}-{str(uuid.uuid4())[:6].upper()}"


def _enrich_order(doc: dict) -> dict:
    doc.pop("_id", None)
    ca = doc.get("created_at")
    if isinstance(ca, str):
        try:
            dt = datetime.fromisoformat(ca)
        except Exception:
            dt = now_utc()
    else:
        dt = ca or now_utc()
    doc["created_at"] = dt
    doc["created_at_fmt"] = format_tanggal_id(dt)
    # datetimes
    for k in ("bukti_bayar_at", "tanggal_kirim"):
        v = doc.get(k)
        if isinstance(v, str):
            try: doc[k] = datetime.fromisoformat(v)
            except Exception: doc[k] = None
    return doc


# ---------- PELANGGAN ----------
@router.post("/checkout", response_model=OrderPublic)
async def checkout(payload: CheckoutRequest, user=Depends(require_roles(ROLE_PELANGGAN))):
    from server import db

    # Ambil alamat
    addr = await db.addresses.find_one({"id": payload.address_id, "user_id": user["id"]})
    if not addr:
        raise HTTPException(status_code=404, detail="Alamat tidak ditemukan")

    # Ambil pengaturan
    settings = await get_settings_internal()
    pembayaran = next((m for m in settings.get("pembayaran", []) if m["kode"] == payload.metode_pembayaran_kode and m.get("aktif")), None)
    pengiriman = next((m for m in settings.get("pengiriman", []) if m["kode"] == payload.metode_pengiriman_kode and m.get("aktif")), None)
    if not pembayaran:
        raise HTTPException(status_code=400, detail="Metode pembayaran tidak aktif")
    if not pengiriman:
        raise HTTPException(status_code=400, detail="Metode pengiriman tidak aktif")

    # Ambil cart user
    cart = await db.carts.find_one({"user_id": user["id"]})
    cart_items = (cart or {}).get("items", []) if cart else []
    if not cart_items:
        raise HTTPException(status_code=400, detail="Keranjang kosong")

    # Validasi + reservasi stok secara aman (per unit)
    now_s = now_utc().isoformat()
    hold_batas = _hold_batas_default().isoformat()
    items_snapshot: List[dict] = []
    reserved: List[str] = []
    try:
        for ci in cart_items:
            unit = await db.units.find_one({"id": ci["unit_id"]})
            if not unit:
                raise HTTPException(status_code=400, detail=f"Unit tidak ditemukan")
            if unit.get("status_publikasi") != "TAYANG":
                raise HTTPException(status_code=400, detail=f"Produk {unit.get('merek','')} {unit.get('model','')} tidak lagi dijual")
            # Reservasi: hanya terima jika TERSEDIA; atomic update
            res = await db.units.update_one(
                {"id": unit["id"], "status_stok": "TERSEDIA"},
                {"$set": {
                    "status_stok": "HOLD",
                    "hold_oleh": user["email"],
                    "hold_at": now_s,
                    "hold_batas": hold_batas,
                    "updated_at": now_s,
                },
                 "$push": {"history_status": {
                     "status_stok": "HOLD", "at": now_s, "oleh": user["email"],
                     "alasan": "Checkout",
                 }}},
            )
            if res.matched_count == 0:
                raise HTTPException(status_code=409, detail=f"Produk {unit.get('merek','')} {unit.get('model','')} sudah tidak tersedia")
            reserved.append(unit["id"])
            items_snapshot.append({
                "unit_id": unit["id"],
                "merek": unit.get("merek", ""),
                "model": unit.get("model", ""),
                "varian": unit.get("varian", ""),
                "warna": unit.get("warna", ""),
                "harga_jual": float(unit.get("harga_jual") or 0),
                "modal": float((unit.get("harga_beli") or 0) + (unit.get("biaya_reparasi") or 0) + (unit.get("biaya_tambahan") or 0)),
                "foto_utama": (unit.get("foto_urls") or [None])[0],
            })
    except Exception as e:
        # Rollback reservasi apabila gagal
        if reserved:
            await db.units.update_many(
                {"id": {"$in": reserved}},
                {"$set": {"status_stok": "TERSEDIA", "hold_batas": None, "hold_oleh": None, "hold_at": None, "updated_at": now_s}}
            )
        raise

    subtotal = sum(x["harga_jual"] for x in items_snapshot)
    biaya_kirim = float(pengiriman.get("default_biaya") or 0)
    total = subtotal + biaya_kirim

    order = {
        "id": str(uuid.uuid4()),
        "nomor_pesanan": _generate_nomor(),
        "user_id": user["id"],
        "nama_pelanggan": user["nama"],
        "email": user["email"],
        "telepon": user.get("telepon", ""),
        "alamat_snapshot": {
            "nama_penerima": addr["nama_penerima"],
            "telepon_penerima": addr["telepon_penerima"],
            "alamat_lengkap": addr["alamat_lengkap"],
            "kelurahan": addr.get("kelurahan", ""),
            "kecamatan": addr["kecamatan"],
            "kabupaten": addr["kabupaten"],
            "provinsi": addr["provinsi"],
            "kode_pos": addr.get("kode_pos", ""),
            "patokan": addr.get("patokan", ""),
        },
        "items": items_snapshot,
        "subtotal": subtotal,
        "biaya_kirim": biaya_kirim,
        "total": total,
        "metode_pengiriman": {"kode": pengiriman["kode"], "nama": pengiriman["nama"]},
        "metode_pembayaran": {"kode": pembayaran["kode"], "nama": pembayaran["nama"]},
        "status_pesanan": "MENUNGGU_BAYAR",
        "status_pembayaran": "BELUM_BAYAR",
        "status_pengiriman": "MENUNGGU",
        "bukti_bayar_url": None,
        "bukti_bayar_at": None,
        "nomor_resi": "",
        "tanggal_kirim": None,
        "estimasi_sampai": "",
        "catatan_pelanggan": payload.catatan_pelanggan or "",
        "catatan_admin": "",
        "hold_batas": hold_batas,
        "created_at": now_s,
        "updated_at": now_s,
    }
    await db.orders.insert_one(order)
    # kosongkan cart
    await db.carts.update_one({"user_id": user["id"]}, {"$set": {"items": [], "updated_at": now_s}})

    return OrderPublic(**_enrich_order(order))


@router.get("/mine", response_model=List[OrderPublic])
async def my_orders(user=Depends(require_roles(ROLE_PELANGGAN))):
    from server import db
    cursor = db.orders.find({"user_id": user["id"]}).sort("created_at", -1).limit(100)
    docs = await cursor.to_list(100)
    return [OrderPublic(**_enrich_order(d)) for d in docs]


@router.get("/{order_id}", response_model=OrderPublic)
async def get_order(order_id: str, user=Depends(require_roles(ROLE_PELANGGAN, ROLE_OWNER, ROLE_ADMIN, ROLE_STAF))):
    from server import db
    doc = await db.orders.find_one({"id": order_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Pesanan tidak ditemukan")
    if user["role"] == ROLE_PELANGGAN and doc.get("user_id") != user["id"]:
        raise HTTPException(status_code=404, detail="Pesanan tidak ditemukan")
    return OrderPublic(**_enrich_order(doc))


@router.post("/{order_id}/bukti-bayar", response_model=OrderPublic)
async def upload_bukti(order_id: str, payload: UploadBuktiBayarRequest, user=Depends(require_roles(ROLE_PELANGGAN))):
    from server import db
    doc = await db.orders.find_one({"id": order_id, "user_id": user["id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Pesanan tidak ditemukan")
    if doc.get("status_pesanan") not in ("MENUNGGU_BAYAR", "MENUNGGU_VERIFIKASI"):
        raise HTTPException(status_code=400, detail="Pesanan tidak dalam status menunggu pembayaran")
    now_s = now_utc().isoformat()
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "bukti_bayar_url": payload.url,
            "bukti_bayar_at": now_s,
            "status_pesanan": "MENUNGGU_VERIFIKASI",
            "status_pembayaran": "MENUNGGU_VERIFIKASI",
            "updated_at": now_s,
        }},
    )
    doc = await db.orders.find_one({"id": order_id})
    return OrderPublic(**_enrich_order(doc))


@router.post("/{order_id}/batal")
async def batal_pesanan(order_id: str, user=Depends(require_roles(ROLE_PELANGGAN))):
    from server import db
    doc = await db.orders.find_one({"id": order_id, "user_id": user["id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Pesanan tidak ditemukan")
    if doc.get("status_pesanan") not in ("MENUNGGU_BAYAR", "MENUNGGU_VERIFIKASI"):
        raise HTTPException(status_code=400, detail="Tidak dapat dibatalkan di status saat ini")
    now_s = now_utc().isoformat()
    # Lepas reservasi stok
    unit_ids = [it["unit_id"] for it in doc.get("items", [])]
    if unit_ids:
        await db.units.update_many(
            {"id": {"$in": unit_ids}, "status_stok": "HOLD"},
            {"$set": {"status_stok": "TERSEDIA", "hold_batas": None, "hold_oleh": None, "updated_at": now_s},
             "$push": {"history_status": {"status_stok": "TERSEDIA", "at": now_s, "oleh": user["email"], "alasan": "Pembatalan pesanan"}}},
        )
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"status_pesanan": "DIBATALKAN", "status_pembayaran": "DITOLAK", "updated_at": now_s}},
    )
    return {"message": "Pesanan dibatalkan"}


# ---------- ADMIN ----------
@router.get("", response_model=List[OrderPublic])
async def list_all_orders(
    status: Optional[str] = None,
    status_pembayaran: Optional[str] = None,
    _user=Depends(require_roles(ROLE_OWNER, ROLE_ADMIN, ROLE_STAF)),
):
    from server import db
    q = {}
    if status: q["status_pesanan"] = status
    if status_pembayaran: q["status_pembayaran"] = status_pembayaran
    cursor = db.orders.find(q).sort("created_at", -1).limit(200)
    docs = await cursor.to_list(200)
    return [OrderPublic(**_enrich_order(d)) for d in docs]


@router.post("/{order_id}/verifikasi-bayar", response_model=OrderPublic)
async def verifikasi_bayar(order_id: str, payload: VerifikasiBayarRequest,
                           user=Depends(require_roles(ROLE_OWNER, ROLE_ADMIN))):
    from server import db
    doc = await db.orders.find_one({"id": order_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Pesanan tidak ditemukan")
    if doc.get("status_pesanan") not in ("MENUNGGU_VERIFIKASI", "MENUNGGU_BAYAR"):
        raise HTTPException(status_code=400, detail="Status pesanan tidak dapat diverifikasi")

    now_s = now_utc().isoformat()
    unit_ids = [it["unit_id"] for it in doc.get("items", [])]
    if payload.diterima:
        # Pembayaran diterima -> unit menjadi TERJUAL
        if unit_ids:
            await db.units.update_many(
                {"id": {"$in": unit_ids}},
                {"$set": {"status_stok": "TERJUAL", "hold_batas": None, "updated_at": now_s},
                 "$push": {"history_status": {"status_stok": "TERJUAL", "at": now_s, "oleh": user["email"], "alasan": f"Pesanan {doc['nomor_pesanan']}"}}},
            )
        await db.orders.update_one(
            {"id": order_id},
            {"$set": {
                "status_pembayaran": "DITERIMA",
                "status_pesanan": "DIPROSES",
                "status_pengiriman": "DIKEMAS",
                "catatan_admin": payload.catatan or "",
                "updated_at": now_s,
            }},
        )
    else:
        # Pembayaran ditolak -> rilis stok, pesanan dibatalkan
        if unit_ids:
            await db.units.update_many(
                {"id": {"$in": unit_ids}, "status_stok": "HOLD"},
                {"$set": {"status_stok": "TERSEDIA", "hold_batas": None, "updated_at": now_s},
                 "$push": {"history_status": {"status_stok": "TERSEDIA", "at": now_s, "oleh": user["email"], "alasan": "Pembayaran ditolak"}}},
            )
        await db.orders.update_one(
            {"id": order_id},
            {"$set": {
                "status_pembayaran": "DITOLAK",
                "status_pesanan": "DIBATALKAN",
                "catatan_admin": payload.catatan or "",
                "updated_at": now_s,
            }},
        )
    doc = await db.orders.find_one({"id": order_id})
    return OrderPublic(**_enrich_order(doc))


@router.patch("/{order_id}/resi", response_model=OrderPublic)
async def update_resi(order_id: str, payload: UpdateResiRequest, user=Depends(require_roles(ROLE_OWNER, ROLE_ADMIN, ROLE_STAF))):
    from server import db
    doc = await db.orders.find_one({"id": order_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Pesanan tidak ditemukan")
    if doc.get("status_pesanan") not in ("DIPROSES", "DIKIRIM"):
        raise HTTPException(status_code=400, detail="Pesanan belum dibayar atau sudah selesai")

    update = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None and v != ""}
    if "status_pengiriman" in update and update["status_pengiriman"] not in STATUS_PENGIRIMAN:
        raise HTTPException(status_code=400, detail="Status pengiriman tidak valid")
    if update.get("status_pengiriman") == "DIKIRIM":
        update["status_pesanan"] = "DIKIRIM"
    if update.get("status_pengiriman") == "DITERIMA":
        update["status_pesanan"] = "SELESAI"
    if isinstance(update.get("tanggal_kirim"), datetime):
        update["tanggal_kirim"] = update["tanggal_kirim"].isoformat()
    update["updated_at"] = now_utc().isoformat()
    await db.orders.update_one({"id": order_id}, {"$set": update})
    doc = await db.orders.find_one({"id": order_id})
    return OrderPublic(**_enrich_order(doc))
