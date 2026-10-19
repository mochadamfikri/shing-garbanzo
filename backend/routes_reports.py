"""Endpoint Laporan Keuangan Toko (Internal Sadam Gadget).
Menghitung realisasi transaksi kasir (POS Sales) + Pengeluaran Toko."""
from datetime import datetime, timedelta, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, Response, HTTPException
import zoneinfo

from auth import require_roles, ROLE_OWNER, ROLE_ADMIN
from utils import now_utc, format_tanggal_id

router = APIRouter(prefix="/api/reports", tags=["reports"])
WIB = zoneinfo.ZoneInfo("Asia/Jakarta")


def _parse_date(s: Optional[str], default: datetime) -> datetime:
    if not s:
        return default
    try:
        return datetime.fromisoformat(s).replace(tzinfo=timezone.utc)
    except Exception:
        return default


def _default_range(start: Optional[str], end: Optional[str]) -> tuple[datetime, datetime]:
    today = now_utc().replace(hour=23, minute=59, second=59, microsecond=999999)
    start_default = (today - timedelta(days=30)).replace(hour=0, minute=0, second=0, microsecond=0)
    s = _parse_date(start, start_default).replace(hour=0, minute=0, second=0, microsecond=0)
    e = _parse_date(end, today).replace(hour=23, minute=59, second=59, microsecond=999999)
    return s, e


async def _fetch_pos_sales(db, start: datetime, end: datetime) -> List[dict]:
    q = {
        "status": "SELESAI",
        "tanggal_jual": {"$gte": start.isoformat(), "$lte": end.isoformat()},
    }
    cursor = db.pos_sales.find(q).sort("tanggal_jual", 1)
    return await cursor.to_list(5000)


@router.get("/summary")
async def summary(
    start: Optional[str] = Query(None, description="YYYY-MM-DD"),
    end: Optional[str] = Query(None),
    _user=Depends(require_roles(ROLE_OWNER, ROLE_ADMIN)),
):
    from server import db
    s, e = _default_range(start, end)
    sales = await _fetch_pos_sales(db, s, e)

    omzet = 0.0
    hpp = 0.0
    biaya_transaksi = 0.0
    unit_terjual = 0
    total_pesanan = len(sales)

    for item_sale in sales:
        omzet += float(item_sale.get("penjualan_bersih") or 0)
        hpp += float(item_sale.get("hpp") or 0)
        biaya_transaksi += float(item_sale.get("biaya_transaksi") or 0)
        unit_terjual += len(item_sale.get("items", []))

    laba_kotor = omzet - hpp

    # Pengeluaran operasional dalam rentang
    exp_cursor = db.expenses.find({"tanggal": {"$gte": s.strftime("%Y-%m-%d"), "$lte": e.strftime("%Y-%m-%d")}})
    exp_docs = await exp_cursor.to_list(1000)
    pengeluaran_total = sum(float(x.get("nominal") or 0) for x in exp_docs)
    by_kategori = {}
    for x in exp_docs:
        by_kategori[x["kategori"]] = by_kategori.get(x["kategori"], 0) + float(x.get("nominal") or 0)
    laba_bersih = laba_kotor - pengeluaran_total - biaya_transaksi

    # Best-seller produk dari POS
    produk_counter = {}
    for item_sale in sales:
        for it in item_sale.get("items", []):
            name = f"{it.get('merek', '')} {it.get('model', '')}".strip()
            produk_counter[name] = produk_counter.get(name, 0) + 1
    
    top_produk = [{"nama": k, "count": v} for k, v in sorted(produk_counter.items(), key=lambda x: x[1], reverse=True)[:5]]

    return {
        "rentang": {"start": s.isoformat(), "end": e.isoformat()},
        "omzet": omzet,
        "hpp": hpp,
        "laba_kotor": laba_kotor,
        "laba_bersih": laba_bersih,
        "total_pesanan": total_pesanan,
        "unit_terjual": unit_terjual,
        "pengeluaran_total": pengeluaran_total,
        "pengeluaran_by_kategori": by_kategori,
        "pesanan_menunggu_bayar": 0,
        "pesanan_verifikasi": 0,
        "top_produk": top_produk,
    }


@router.get("/timeseries")
async def timeseries(
    start: Optional[str] = Query(None),
    end: Optional[str] = Query(None),
    _user=Depends(require_roles(ROLE_OWNER, ROLE_ADMIN)),
):
    from server import db
    s, e = _default_range(start, end)
    sales = await _fetch_pos_sales(db, s, e)

    # Agregasi harian
    daily = {}
    cur = s.replace(hour=0, minute=0, second=0, microsecond=0)
    end_day = e.replace(hour=0, minute=0, second=0, microsecond=0)
    while cur <= end_day:
        k = cur.strftime("%Y-%m-%d")
        daily[k] = {"tanggal": k, "omzet": 0.0, "hpp": 0.0, "laba_kotor": 0.0, "unit": 0, "pesanan": 0}
        cur += timedelta(days=1)

    for item_sale in sales:
        tgl_str = item_sale.get("tanggal_jual", "")
        if tgl_str:
            try:
                day_key = tgl_str[:10]
            except Exception:
                continue
            if day_key in daily:
                omzet_sale = float(item_sale.get("penjualan_bersih") or 0)
                hpp_sale = float(item_sale.get("hpp") or 0)
                daily[day_key]["omzet"] += omzet_sale
                daily[day_key]["hpp"] += hpp_sale
                daily[day_key]["laba_kotor"] += (omzet_sale - hpp_sale)
                daily[day_key]["unit"] += len(item_sale.get("items", []))
                daily[day_key]["pesanan"] += 1

    harian = sorted(daily.values(), key=lambda x: x["tanggal"])
    return {"harian": harian}


@router.get("/inventory-value")
async def inventory_value(_user=Depends(require_roles(ROLE_OWNER, ROLE_ADMIN))):
    from server import db
    pipeline = [
        {"$match": {"status_stok": {"$in": ["TERSEDIA", "HOLD"]}}},
        {"$group": {
            "_id": None,
            "total_unit": {"$sum": 1},
            "nilai_beli": {"$sum": {"$ifNull": ["$harga_beli", 0]}},
            "nilai_jual": {"$sum": {"$ifNull": ["$harga_jual", 0]}},
            "biaya_reparasi": {"$sum": {"$ifNull": ["$biaya_reparasi", 0]}},
            "biaya_operasional": {"$sum": {"$ifNull": ["$biaya_operasional", 0]}},
        }}
    ]
    docs = await db.units.aggregate(pipeline).to_list(1)
    if not docs:
        return {"total_unit": 0, "total_modal": 0, "total_nilai_jual": 0, "potensi_laba": 0}
    d = docs[0]
    total_modal = float(d.get("nilai_beli", 0)) + float(d.get("biaya_reparasi", 0)) + float(d.get("biaya_operasional", 0))
    total_nilai_jual = float(d.get("nilai_jual", 0))
    return {
        "total_unit": d.get("total_unit", 0),
        "total_modal": total_modal,
        "total_nilai_jual": total_nilai_jual,
        "potensi_laba": total_nilai_jual - total_modal,
    }
