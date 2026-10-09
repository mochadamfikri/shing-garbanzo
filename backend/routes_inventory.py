"""CRUD inventaris smartphone + validasi IMEI + audit log."""
import uuid
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Depends, Query

from auth import require_roles, ROLE_OWNER, ROLE_ADMIN, ROLE_STAF, FINANCE_ROLES
from models import (
    UnitHPCreate, UnitHPUpdate, UnitHPPublic,
    JENIS_PERANGKAT, KONDISI, STATUS_STOK, STATUS_PUBLIKASI,
)
from utils import validate_imei, now_utc, format_tanggal_id

router = APIRouter(prefix="/api/inventory", tags=["inventory"])


def _enrich(doc: dict, hide_finance: bool = False) -> dict:
    doc.pop("_id", None)
    harga_beli = float(doc.get("harga_beli") or 0)
    biaya_reparasi = float(doc.get("biaya_reparasi") or 0)
    biaya_tambahan = float(doc.get("biaya_tambahan") or 0)
    harga_jual = float(doc.get("harga_jual") or 0)
    total_modal = harga_beli + biaya_reparasi + biaya_tambahan
    estimasi_laba_kotor = harga_jual - total_modal
    doc["total_modal"] = total_modal
    doc["estimasi_laba_kotor"] = estimasi_laba_kotor
    ti = doc.get("tanggal_input")
    if isinstance(ti, str):
        try:
            ti_dt = datetime.fromisoformat(ti)
        except Exception:
            ti_dt = now_utc()
    else:
        ti_dt = ti or now_utc()
    doc["tanggal_input"] = ti_dt
    doc["tanggal_input_fmt"] = format_tanggal_id(ti_dt)
    if hide_finance:
        for k in ("harga_beli", "biaya_reparasi", "biaya_tambahan", "total_modal", "estimasi_laba_kotor", "supplier"):
            doc[k] = 0 if isinstance(doc.get(k), (int, float)) else ""
    return doc


async def _log_audit(db, user: dict, action: str, entity: str, entity_id: str, meta: Optional[dict] = None):
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_email": user["email"],
        "user_role": user["role"],
        "action": action,
        "entity": entity,
        "entity_id": entity_id,
        "meta": meta or {},
        "at": now_utc().isoformat(),
    })


@router.post("/validate-imei")
async def check_imei(payload: dict, _user=Depends(require_roles(ROLE_OWNER, ROLE_ADMIN, ROLE_STAF))):
    from server import db
    imei = (payload.get("imei") or "").strip()
    exclude_id = payload.get("exclude_id")
    ok, msg = validate_imei(imei)
    if not ok:
        return {"valid": False, "duplicate": False, "message": msg}
    q = {"$or": [{"imei_1": imei}, {"imei_2": imei}]}
    if exclude_id:
        q = {"$and": [q, {"id": {"$ne": exclude_id}}]}
    dup = await db.units.find_one(q)
    if dup:
        return {"valid": True, "duplicate": True, "message": f"IMEI sudah terdaftar pada unit {dup.get('merek','')} {dup.get('model','')}"}
    return {"valid": True, "duplicate": False, "message": "IMEI valid dan belum terdaftar"}


@router.post("", response_model=UnitHPPublic)
async def create_unit(payload: UnitHPCreate,
                      user=Depends(require_roles(ROLE_OWNER, ROLE_ADMIN, ROLE_STAF))):
    from server import db
    # Validasi
    if payload.jenis_perangkat not in JENIS_PERANGKAT:
        raise HTTPException(status_code=400, detail="Jenis perangkat harus INTER atau RESMI")
    if payload.kondisi not in KONDISI:
        raise HTTPException(status_code=400, detail="Kondisi harus BARU/BEKAS/REFURBISHED")
    if payload.status_stok not in STATUS_STOK:
        raise HTTPException(status_code=400, detail="Status stok tidak valid")
    if payload.status_publikasi not in STATUS_PUBLIKASI:
        raise HTTPException(status_code=400, detail="Status publikasi tidak valid")
    ok1, msg1 = validate_imei(payload.imei_1)
    if not ok1:
        raise HTTPException(status_code=400, detail=f"IMEI 1: {msg1}")
    if payload.imei_2:
        ok2, msg2 = validate_imei(payload.imei_2)
        if not ok2:
            raise HTTPException(status_code=400, detail=f"IMEI 2: {msg2}")
    # Cek duplikat
    dup_q = {"$or": [{"imei_1": payload.imei_1}, {"imei_2": payload.imei_1}]}
    if payload.imei_2:
        dup_q = {"$or": dup_q["$or"] + [{"imei_1": payload.imei_2}, {"imei_2": payload.imei_2}]}
    if await db.units.find_one(dup_q):
        raise HTTPException(status_code=409, detail="IMEI sudah terdaftar di sistem")

    unit = payload.model_dump()
    unit["id"] = str(uuid.uuid4())
    unit["tanggal_input"] = now_utc().isoformat()
    unit["dibuat_oleh"] = user["email"]
    unit["updated_at"] = unit["tanggal_input"]
    unit["history_harga"] = [{"harga_jual": payload.harga_jual, "at": unit["tanggal_input"], "oleh": user["email"]}]
    unit["history_status"] = [{"status_stok": payload.status_stok, "at": unit["tanggal_input"], "oleh": user["email"]}]

    await db.units.insert_one(unit)
    await _log_audit(db, user, "CREATE_UNIT", "unit", unit["id"], {"merek": unit["merek"], "model": unit["model"]})
    return UnitHPPublic(**_enrich(unit, hide_finance=False))


@router.get("", response_model=List[UnitHPPublic])
async def list_units(
    q: Optional[str] = Query(None, description="pencarian IMEI/merek/model"),
    merek: Optional[str] = None,
    kondisi: Optional[str] = None,
    status_stok: Optional[str] = None,
    status_publikasi: Optional[str] = None,
    limit: int = 200,
    user=Depends(require_roles(ROLE_OWNER, ROLE_ADMIN, ROLE_STAF)),
):
    from server import db
    query = {}
    if merek:
        query["merek"] = merek
    if kondisi:
        query["kondisi"] = kondisi
    if status_stok:
        query["status_stok"] = status_stok
    if status_publikasi:
        query["status_publikasi"] = status_publikasi
    if q:
        qs = q.strip()
        query["$or"] = [
            {"imei_1": {"$regex": qs, "$options": "i"}},
            {"imei_2": {"$regex": qs, "$options": "i"}},
            {"merek": {"$regex": qs, "$options": "i"}},
            {"model": {"$regex": qs, "$options": "i"}},
            {"serial_number": {"$regex": qs, "$options": "i"}},
        ]
    cursor = db.units.find(query).sort("tanggal_input", -1).limit(limit)
    docs = await cursor.to_list(limit)
    hide = user["role"] not in FINANCE_ROLES
    return [UnitHPPublic(**_enrich(d, hide_finance=hide)) for d in docs]


@router.get("/{unit_id}", response_model=UnitHPPublic)
async def get_unit(unit_id: str, user=Depends(require_roles(ROLE_OWNER, ROLE_ADMIN, ROLE_STAF))):
    from server import db
    doc = await db.units.find_one({"id": unit_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Unit tidak ditemukan")
    hide = user["role"] not in FINANCE_ROLES
    return UnitHPPublic(**_enrich(doc, hide_finance=hide))


@router.patch("/{unit_id}", response_model=UnitHPPublic)
async def update_unit(unit_id: str, payload: UnitHPUpdate,
                      user=Depends(require_roles(ROLE_OWNER, ROLE_ADMIN, ROLE_STAF))):
    from server import db
    existing = await db.units.find_one({"id": unit_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Unit tidak ditemukan")

    update_data = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None or k in ("imei_2", "kesehatan_baterai", "alasan_hold")}

    # Validasi
    if "jenis_perangkat" in update_data and update_data["jenis_perangkat"] not in JENIS_PERANGKAT:
        raise HTTPException(status_code=400, detail="Jenis perangkat tidak valid")
    if "kondisi" in update_data and update_data["kondisi"] not in KONDISI:
        raise HTTPException(status_code=400, detail="Kondisi tidak valid")
    if "status_stok" in update_data and update_data["status_stok"] not in STATUS_STOK:
        raise HTTPException(status_code=400, detail="Status stok tidak valid")
    if "status_publikasi" in update_data and update_data["status_publikasi"] not in STATUS_PUBLIKASI:
        raise HTTPException(status_code=400, detail="Status publikasi tidak valid")

    for key in ("imei_1", "imei_2"):
        if key in update_data and update_data[key]:
            ok, msg = validate_imei(update_data[key])
            if not ok:
                raise HTTPException(status_code=400, detail=f"{key.upper()}: {msg}")
            dup = await db.units.find_one({
                "$and": [
                    {"id": {"$ne": unit_id}},
                    {"$or": [{"imei_1": update_data[key]}, {"imei_2": update_data[key]}]},
                ]
            })
            if dup:
                raise HTTPException(status_code=409, detail=f"{key.upper()} sudah terdaftar di unit lain")

    now_s = now_utc().isoformat()
    push_ops = {}
    if "harga_jual" in update_data and update_data["harga_jual"] != existing.get("harga_jual"):
        push_ops["history_harga"] = {"harga_jual": update_data["harga_jual"], "at": now_s, "oleh": user["email"]}
    if "status_stok" in update_data and update_data["status_stok"] != existing.get("status_stok"):
        push_ops["history_status"] = {
            "status_stok": update_data["status_stok"], "at": now_s, "oleh": user["email"],
            "alasan": update_data.get("alasan_hold", ""),
        }
        if update_data["status_stok"] == "HOLD":
            update_data["hold_oleh"] = user["email"]
            update_data["hold_at"] = now_s
    update_data["updated_at"] = now_s

    update_doc = {"$set": update_data}
    if push_ops:
        update_doc["$push"] = {k: v for k, v in push_ops.items()}

    await db.units.update_one({"id": unit_id}, update_doc)
    await _log_audit(db, user, "UPDATE_UNIT", "unit", unit_id, {"fields": list(update_data.keys())})

    doc = await db.units.find_one({"id": unit_id})
    hide = user["role"] not in FINANCE_ROLES
    return UnitHPPublic(**_enrich(doc, hide_finance=hide))


@router.delete("/{unit_id}")
async def archive_unit(unit_id: str, user=Depends(require_roles(ROLE_OWNER, ROLE_ADMIN))):
    """Soft delete -> arsipkan"""
    from server import db
    res = await db.units.update_one(
        {"id": unit_id},
        {"$set": {"status_stok": "DIARSIPKAN", "status_publikasi": "DIARSIPKAN", "updated_at": now_utc().isoformat()}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Unit tidak ditemukan")
    await _log_audit(db, user, "ARCHIVE_UNIT", "unit", unit_id)
    return {"message": "Unit berhasil diarsipkan"}
