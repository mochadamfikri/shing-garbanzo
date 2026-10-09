"""Endpoint pelanggan: alamat, consent promosi, keranjang."""
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException

from auth import require_roles, ROLE_PELANGGAN
from models import (
    AddressCreate, AddressPublic, PromoConsentUpdate,
    CartAddRequest, CartItemPublic, CartPublic,
)
from utils import now_utc

router = APIRouter(prefix="/api/customer", tags=["customer"])


# ---------- ALAMAT ----------
@router.get("/addresses", response_model=List[AddressPublic])
async def list_addresses(user=Depends(require_roles(ROLE_PELANGGAN))):
    from server import db
    docs = await db.addresses.find({"user_id": user["id"]}, {"_id": 0}).sort("is_default", -1).to_list(50)
    return [AddressPublic(**d) for d in docs]


@router.post("/addresses", response_model=AddressPublic)
async def create_address(payload: AddressCreate, user=Depends(require_roles(ROLE_PELANGGAN))):
    from server import db
    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["user_id"] = user["id"]
    doc["created_at"] = now_utc().isoformat()
    if doc.get("is_default"):
        await db.addresses.update_many({"user_id": user["id"]}, {"$set": {"is_default": False}})
    else:
        # jika belum ada alamat, otomatis default
        if await db.addresses.count_documents({"user_id": user["id"]}) == 0:
            doc["is_default"] = True
    await db.addresses.insert_one(doc)
    return AddressPublic(**doc)


@router.patch("/addresses/{address_id}", response_model=AddressPublic)
async def update_address(address_id: str, payload: AddressCreate, user=Depends(require_roles(ROLE_PELANGGAN))):
    from server import db
    existing = await db.addresses.find_one({"id": address_id, "user_id": user["id"]})
    if not existing:
        raise HTTPException(status_code=404, detail="Alamat tidak ditemukan")
    data = payload.model_dump()
    if data.get("is_default"):
        await db.addresses.update_many({"user_id": user["id"]}, {"$set": {"is_default": False}})
    await db.addresses.update_one({"id": address_id}, {"$set": data})
    doc = await db.addresses.find_one({"id": address_id}, {"_id": 0})
    return AddressPublic(**doc)


@router.delete("/addresses/{address_id}")
async def delete_address(address_id: str, user=Depends(require_roles(ROLE_PELANGGAN))):
    from server import db
    res = await db.addresses.delete_one({"id": address_id, "user_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Alamat tidak ditemukan")
    return {"message": "Alamat dihapus"}


# ---------- CONSENT PROMOSI ----------
@router.patch("/promo-consent")
async def update_promo_consent(payload: PromoConsentUpdate, user=Depends(require_roles(ROLE_PELANGGAN))):
    from server import db
    now_s = now_utc().isoformat()
    existing = user.get("promo_consent") or {}
    if payload.setujui:
        consent = {
            "status": True,
            "versi": payload.versi,
            "sumber": "dashboard",
            "saluran": payload.saluran or [],
            "consented_at": now_s,
            "revoked_at": None,
        }
    else:
        consent = {
            **existing,
            "status": False,
            "revoked_at": now_s,
        }
    await db.users.update_one({"id": user["id"]}, {"$set": {"promo_consent": consent}})
    return {"promo_consent": consent}


# ---------- KERANJANG ----------
async def _unit_snapshot(db, unit_id: str):
    doc = await db.units.find_one({"id": unit_id})
    if not doc:
        return None
    return {
        "unit_id": unit_id,
        "merek": doc.get("merek", ""),
        "model": doc.get("model", ""),
        "varian": doc.get("varian", ""),
        "warna": doc.get("warna", ""),
        "harga_jual": float(doc.get("harga_jual") or 0),
        "foto_utama": (doc.get("foto_urls") or [None])[0],
        "tersedia": doc.get("status_stok") == "TERSEDIA" and doc.get("status_publikasi") == "TAYANG",
    }


async def _get_cart_doc(db, user_id: str) -> dict:
    doc = await db.carts.find_one({"user_id": user_id})
    if not doc:
        doc = {
            "id": str(uuid.uuid4()), "user_id": user_id,
            "items": [], "created_at": now_utc().isoformat(), "updated_at": now_utc().isoformat(),
        }
        await db.carts.insert_one(doc)
    return doc


@router.get("", response_model=CartPublic)
async def get_cart(user=Depends(require_roles(ROLE_PELANGGAN))):
    from server import db
    doc = await _get_cart_doc(db, user["id"])
    items = []
    subtotal = 0.0
    for raw in doc.get("items", []):
        snap = await _unit_snapshot(db, raw["unit_id"])
        if not snap:
            continue
        items.append(CartItemPublic(unit_id=snap["unit_id"], added_at=raw.get("added_at"), **{k: v for k, v in snap.items() if k != "unit_id"}))
        if snap["tersedia"]:
            subtotal += snap["harga_jual"]
    return CartPublic(items=items, jumlah_item=len(items), subtotal=subtotal)


@router.post("")
async def add_to_cart(payload: CartAddRequest, user=Depends(require_roles(ROLE_PELANGGAN))):
    from server import db
    unit = await db.units.find_one({"id": payload.unit_id})
    if not unit:
        raise HTTPException(status_code=404, detail="Unit tidak ditemukan")
    if unit.get("status_publikasi") != "TAYANG":
        raise HTTPException(status_code=400, detail="Produk tidak tayang")
    if unit.get("status_stok") != "TERSEDIA":
        raise HTTPException(status_code=400, detail=f"Produk sedang {unit.get('status_stok')}, tidak dapat ditambahkan")

    doc = await _get_cart_doc(db, user["id"])
    if any(it.get("unit_id") == payload.unit_id for it in doc.get("items", [])):
        return {"message": "Sudah di keranjang"}
    await db.carts.update_one(
        {"user_id": user["id"]},
        {"$push": {"items": {"unit_id": payload.unit_id, "added_at": now_utc().isoformat()}},
         "$set": {"updated_at": now_utc().isoformat()}},
    )
    return {"message": "Ditambahkan ke keranjang"}


@router.delete("/{unit_id}")
async def remove_from_cart(unit_id: str, user=Depends(require_roles(ROLE_PELANGGAN))):
    from server import db
    await db.carts.update_one(
        {"user_id": user["id"]},
        {"$pull": {"items": {"unit_id": unit_id}}, "$set": {"updated_at": now_utc().isoformat()}},
    )
    return {"message": "Item dihapus"}


@router.delete("")
async def clear_cart(user=Depends(require_roles(ROLE_PELANGGAN))):
    from server import db
    await db.carts.update_one(
        {"user_id": user["id"]},
        {"$set": {"items": [], "updated_at": now_utc().isoformat()}},
    )
    return {"message": "Keranjang dikosongkan"}
