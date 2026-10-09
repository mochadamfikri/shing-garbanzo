"""Endpoint Pengeluaran Operasional (Fase 4)."""
import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, ConfigDict

from auth import require_roles, ROLE_OWNER, ROLE_ADMIN
from utils import now_utc, format_tanggal_id

router = APIRouter(prefix="/api/expenses", tags=["expenses"])

KATEGORI = {"SEWA", "LISTRIK", "INTERNET", "GAJI", "PEMASARAN", "KEMASAN", "LOGISTIK", "LAINNYA"}


class ExpenseCreate(BaseModel):
    kategori: str
    nominal: float
    tanggal: str  # ISO date YYYY-MM-DD
    keterangan: Optional[str] = ""


class ExpensePublic(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    kategori: str
    nominal: float
    tanggal: str
    tanggal_fmt: str = ""
    keterangan: Optional[str] = ""
    dibuat_oleh: Optional[str] = ""
    created_at: datetime


def _enrich(doc: dict) -> dict:
    doc.pop("_id", None)
    try:
        dt = datetime.fromisoformat(doc["tanggal"])
        doc["tanggal_fmt"] = format_tanggal_id(dt)
    except Exception:
        doc["tanggal_fmt"] = doc.get("tanggal", "")
    return doc


@router.post("", response_model=ExpensePublic)
async def create_expense(payload: ExpenseCreate, user=Depends(require_roles(ROLE_OWNER, ROLE_ADMIN))):
    from server import db
    if payload.kategori not in KATEGORI:
        raise HTTPException(status_code=400, detail=f"Kategori harus salah satu: {', '.join(sorted(KATEGORI))}")
    if payload.nominal <= 0:
        raise HTTPException(status_code=400, detail="Nominal harus > 0")
    try:
        # Normalisasi ke ISO
        datetime.fromisoformat(payload.tanggal)
    except Exception:
        raise HTTPException(status_code=400, detail="Format tanggal YYYY-MM-DD")
    doc = {
        "id": str(uuid.uuid4()),
        "kategori": payload.kategori,
        "nominal": float(payload.nominal),
        "tanggal": payload.tanggal,
        "keterangan": payload.keterangan or "",
        "dibuat_oleh": user["email"],
        "created_at": now_utc().isoformat(),
    }
    await db.expenses.insert_one(doc)
    return ExpensePublic(**_enrich(doc))


@router.get("", response_model=List[ExpensePublic])
async def list_expenses(
    start: Optional[str] = None, end: Optional[str] = None, kategori: Optional[str] = None,
    _user=Depends(require_roles(ROLE_OWNER, ROLE_ADMIN)),
):
    from server import db
    q = {}
    if kategori: q["kategori"] = kategori
    if start or end:
        rng = {}
        if start: rng["$gte"] = start
        if end: rng["$lte"] = end
        q["tanggal"] = rng
    cursor = db.expenses.find(q).sort("tanggal", -1).limit(500)
    docs = await cursor.to_list(500)
    return [ExpensePublic(**_enrich(d)) for d in docs]


@router.delete("/{expense_id}")
async def delete_expense(expense_id: str, _user=Depends(require_roles(ROLE_OWNER, ROLE_ADMIN))):
    from server import db
    res = await db.expenses.delete_one({"id": expense_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Pengeluaran tidak ditemukan")
    return {"message": "Pengeluaran dihapus"}
