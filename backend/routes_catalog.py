"""Endpoint publik katalog toko online (tanpa autentikasi).
Menampilkan unit berstatus TAYANG + stok TERSEDIA/HOLD. Sembunyikan IMEI, modal, supplier."""
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query

from models import CatalogItemPublic
from utils import format_tanggal_id, now_utc
from datetime import datetime

router = APIRouter(prefix="/api/catalog", tags=["catalog"])


def _to_catalog(doc: dict) -> dict:
    doc.pop("_id", None)
    return {
        "id": doc.get("id"),
        "merek": doc.get("merek", ""),
        "model": doc.get("model", ""),
        "varian": doc.get("varian", ""),
        "ram": doc.get("ram", ""),
        "penyimpanan": doc.get("penyimpanan", ""),
        "warna": doc.get("warna", ""),
        "jenis_perangkat": doc.get("jenis_perangkat", "INTER"),
        "kondisi": doc.get("kondisi", "BARU"),
        "grade_fisik": doc.get("grade_fisik", ""),
        "kesehatan_baterai": doc.get("kesehatan_baterai"),
        "kelengkapan": doc.get("kelengkapan", ""),
        "garansi": doc.get("garansi", ""),
        "harga_jual": float(doc.get("harga_jual") or 0),
        "foto_urls": doc.get("foto_urls", []) or [],
        "video_urls": doc.get("video_urls", []) or [],
        "deskripsi": doc.get("deskripsi", ""),
        "tersedia": doc.get("status_stok") == "TERSEDIA",
        "produk_unggulan": bool(doc.get("produk_unggulan")),
    }


@router.get("", response_model=List[CatalogItemPublic])
async def list_catalog(
    q: Optional[str] = None,
    merek: Optional[str] = None,
    kondisi: Optional[str] = None,
    jenis_perangkat: Optional[str] = None,
    harga_min: Optional[float] = None,
    harga_max: Optional[float] = None,
    unggulan: Optional[bool] = None,
    sort: Optional[str] = Query("baru", description="baru|harga_naik|harga_turun"),
    limit: int = 60,
):
    from server import db
    query = {
        "status_publikasi": "TAYANG",
        "status_stok": {"$in": ["TERSEDIA", "HOLD"]},
    }
    if merek: query["merek"] = merek
    if kondisi: query["kondisi"] = kondisi
    if jenis_perangkat: query["jenis_perangkat"] = jenis_perangkat
    if unggulan: query["produk_unggulan"] = True
    if harga_min is not None or harga_max is not None:
        rng = {}
        if harga_min is not None: rng["$gte"] = harga_min
        if harga_max is not None: rng["$lte"] = harga_max
        query["harga_jual"] = rng
    if q:
        qs = q.strip()
        query["$or"] = [
            {"merek": {"$regex": qs, "$options": "i"}},
            {"model": {"$regex": qs, "$options": "i"}},
            {"varian": {"$regex": qs, "$options": "i"}},
            {"deskripsi": {"$regex": qs, "$options": "i"}},
        ]
    sort_spec = [("tanggal_input", -1)]
    if sort == "harga_naik":
        sort_spec = [("harga_jual", 1)]
    elif sort == "harga_turun":
        sort_spec = [("harga_jual", -1)]
    cursor = db.units.find(query).sort(sort_spec).limit(limit)
    docs = await cursor.to_list(limit)
    return [CatalogItemPublic(**_to_catalog(d)) for d in docs]


@router.get("/featured", response_model=List[CatalogItemPublic])
async def featured(limit: int = 8):
    from server import db
    q = {"status_publikasi": "TAYANG", "produk_unggulan": True, "status_stok": "TERSEDIA"}
    docs = await db.units.find(q).sort("tanggal_input", -1).limit(limit).to_list(limit)
    if len(docs) < limit:
        # fallback: tambah produk terbaru
        more = await db.units.find(
            {"status_publikasi": "TAYANG", "status_stok": "TERSEDIA", "id": {"$nin": [d["id"] for d in docs]}}
        ).sort("tanggal_input", -1).limit(limit - len(docs)).to_list(limit)
        docs.extend(more)
    return [CatalogItemPublic(**_to_catalog(d)) for d in docs]


@router.get("/brands")
async def brands():
    from server import db
    pipe = [
        {"$match": {"status_publikasi": "TAYANG"}},
        {"$group": {"_id": "$merek", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    res = [{"merek": d["_id"], "count": d["count"]} async for d in db.units.aggregate(pipe) if d.get("_id")]
    return res


@router.get("/{unit_id}", response_model=CatalogItemPublic)
async def catalog_detail(unit_id: str):
    from server import db
    doc = await db.units.find_one({"id": unit_id, "status_publikasi": "TAYANG"})
    if not doc:
        raise HTTPException(status_code=404, detail="Produk tidak ditemukan")
    return CatalogItemPublic(**_to_catalog(doc))
