"""Endpoint Laporan Keuangan + Penjualan (Fase 4).
Omzet, HPP, laba kotor/bersih, time-series harian, dan export CSV."""
import csv
import io
from datetime import datetime, timedelta, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, Response

from auth import require_roles, ROLE_OWNER, ROLE_ADMIN
from utils import now_utc, format_tanggal_id

router = APIRouter(prefix="/api/reports", tags=["reports"])

# Status yang menandakan transaksi direalisasikan (menghasilkan omzet)
STATUS_REALISASI = ["DIPROSES", "DIKIRIM", "SELESAI"]


def _parse_date(s: Optional[str], default: datetime) -> datetime:
    if not s:
        return default
    try:
        return datetime.fromisoformat(s).replace(tzinfo=timezone.utc)
    except Exception:
        return default


def _default_range(start: Optional[str], end: Optional[str]) -> tuple[datetime, datetime]:
    today = now_utc().replace(hour=23, minute=59, second=59, microsecond=0)
    start_default = (today - timedelta(days=29)).replace(hour=0, minute=0, second=0, microsecond=0)
    s = _parse_date(start, start_default).replace(hour=0, minute=0, second=0, microsecond=0)
    e = _parse_date(end, today).replace(hour=23, minute=59, second=59, microsecond=0)
    return s, e


async def _fetch_orders(db, start: datetime, end: datetime) -> List[dict]:
    q = {
        "status_pesanan": {"$in": STATUS_REALISASI},
        "created_at": {"$gte": start.isoformat(), "$lte": end.isoformat()},
    }
    cursor = db.orders.find(q).sort("created_at", 1)
    return await cursor.to_list(5000)


def _order_metrics(order: dict) -> dict:
    items = order.get("items", [])
    omzet = float(order.get("subtotal") or 0)
    hpp = sum(float(it.get("modal") or 0) for it in items)
    biaya_kirim = float(order.get("biaya_kirim") or 0)
    laba_kotor = omzet - hpp
    unit_count = len(items)
    return {"omzet": omzet, "hpp": hpp, "biaya_kirim": biaya_kirim, "laba_kotor": laba_kotor, "unit_count": unit_count}


@router.get("/summary")
async def summary(
    start: Optional[str] = Query(None, description="YYYY-MM-DD"),
    end: Optional[str] = Query(None),
    _user=Depends(require_roles(ROLE_OWNER, ROLE_ADMIN)),
):
    from server import db
    s, e = _default_range(start, end)
    orders = await _fetch_orders(db, s, e)

    omzet = hpp = biaya_kirim = unit_terjual = 0.0
    total_pesanan = len(orders)
    for o in orders:
        m = _order_metrics(o)
        omzet += m["omzet"]; hpp += m["hpp"]; biaya_kirim += m["biaya_kirim"]
        unit_terjual += m["unit_count"]
    laba_kotor = omzet - hpp

    # Pengeluaran dalam rentang
    exp_cursor = db.expenses.find({"tanggal": {"$gte": s.strftime("%Y-%m-%d"), "$lte": e.strftime("%Y-%m-%d")}})
    exp_docs = await exp_cursor.to_list(1000)
    pengeluaran_total = sum(float(x.get("nominal") or 0) for x in exp_docs)
    by_kategori = {}
    for x in exp_docs:
        by_kategori[x["kategori"]] = by_kategori.get(x["kategori"], 0) + float(x.get("nominal") or 0)
    laba_bersih = laba_kotor - pengeluaran_total

    # Status counters (sepanjang waktu, bukan rentang)
    pesanan_menunggu_bayar = await db.orders.count_documents({"status_pesanan": "MENUNGGU_BAYAR"})
    pesanan_verifikasi = await db.orders.count_documents({"status_pesanan": "MENUNGGU_VERIFIKASI"})

    # Produk terlaris periode (by merek+model)
    top = {}
    for o in orders:
        for it in o.get("items", []):
            key = f"{it.get('merek','')} {it.get('model','')}".strip()
            if not key: continue
            top[key] = top.get(key, 0) + 1
    top_sorted = sorted([{"produk": k, "unit": v} for k, v in top.items()], key=lambda x: -x["unit"])[:5]

    return {
        "rentang": {"start": s.strftime("%Y-%m-%d"), "end": e.strftime("%Y-%m-%d")},
        "omzet": omzet,
        "hpp": hpp,
        "laba_kotor": laba_kotor,
        "pengeluaran": pengeluaran_total,
        "pengeluaran_per_kategori": [{"kategori": k, "nominal": v} for k, v in sorted(by_kategori.items(), key=lambda x: -x[1])],
        "laba_bersih": laba_bersih,
        "profit_loss": "PROFIT" if laba_bersih >= 0 else "LOSS",
        "biaya_kirim": biaya_kirim,
        "unit_terjual": unit_terjual,
        "total_pesanan": total_pesanan,
        "pesanan_menunggu_bayar": pesanan_menunggu_bayar,
        "pesanan_menunggu_verifikasi": pesanan_verifikasi,
        "top_produk": top_sorted,
    }


@router.get("/timeseries")
async def timeseries(
    start: Optional[str] = None, end: Optional[str] = None,
    _user=Depends(require_roles(ROLE_OWNER, ROLE_ADMIN)),
):
    """Series harian: omzet, HPP, laba_kotor, laba_bersih (bersama pengeluaran harian), unit terjual, pesanan.
    Juga menyediakan data OHLC untuk candlestick: open/high/low/close dari omzet per minggu."""
    from server import db
    s, e = _default_range(start, end)
    orders = await _fetch_orders(db, s, e)

    # bucket per hari
    daily: dict[str, dict] = {}
    cur = s.date()
    while cur <= e.date():
        daily[cur.isoformat()] = {"tanggal": cur.isoformat(), "omzet": 0.0, "hpp": 0.0, "laba_kotor": 0.0, "laba_bersih": 0.0, "pengeluaran": 0.0, "unit_terjual": 0, "pesanan": 0}
        cur = cur + timedelta(days=1)

    for o in orders:
        try:
            d = datetime.fromisoformat(o["created_at"]).date().isoformat()
        except Exception:
            continue
        if d not in daily: continue
        m = _order_metrics(o)
        daily[d]["omzet"] += m["omzet"]
        daily[d]["hpp"] += m["hpp"]
        daily[d]["laba_kotor"] += m["laba_kotor"]
        daily[d]["unit_terjual"] += m["unit_count"]
        daily[d]["pesanan"] += 1

    # tambahkan pengeluaran harian
    exp_cursor = db.expenses.find({"tanggal": {"$gte": s.strftime("%Y-%m-%d"), "$lte": e.strftime("%Y-%m-%d")}})
    async for x in exp_cursor:
        d = x.get("tanggal")
        if d in daily:
            daily[d]["pengeluaran"] += float(x.get("nominal") or 0)

    # kalkulasi laba bersih per hari
    for d, row in daily.items():
        row["laba_bersih"] = row["laba_kotor"] - row["pengeluaran"]

    rows = [daily[k] for k in sorted(daily.keys())]

    # OHLC per minggu (open=omzet hari pertama minggu, high=max harian, low=min harian, close=omzet hari terakhir)
    weekly_ohlc = []
    if rows:
        from itertools import groupby
        def week_key(r):
            d = datetime.fromisoformat(r["tanggal"]).date()
            iso = d.isocalendar()
            return f"{iso[0]}-W{iso[1]:02d}"
        for wk, grp in groupby(rows, key=week_key):
            days = list(grp)
            omzets = [d["omzet"] for d in days]
            if not omzets: continue
            weekly_ohlc.append({
                "label": wk,
                "mulai": days[0]["tanggal"],
                "akhir": days[-1]["tanggal"],
                "open": omzets[0],
                "high": max(omzets),
                "low": min(omzets),
                "close": omzets[-1],
                "volume_unit": sum(d["unit_terjual"] for d in days),
            })

    return {"rentang": {"start": s.strftime("%Y-%m-%d"), "end": e.strftime("%Y-%m-%d")}, "harian": rows, "mingguan_ohlc": weekly_ohlc}


@router.get("/inventory-value")
async def inventory_value(_user=Depends(require_roles(ROLE_OWNER, ROLE_ADMIN))):
    """Nilai inventaris saat ini (stok tersedia + hold)."""
    from server import db
    pipe = [
        {"$match": {"status_stok": {"$in": ["TERSEDIA", "HOLD"]}}},
        {"$group": {
            "_id": "$merek",
            "unit": {"$sum": 1},
            "modal": {"$sum": {"$add": [
                {"$ifNull": ["$harga_beli", 0]}, {"$ifNull": ["$biaya_reparasi", 0]}, {"$ifNull": ["$biaya_tambahan", 0]},
            ]}},
            "nilai_jual": {"$sum": {"$ifNull": ["$harga_jual", 0]}},
        }},
        {"$sort": {"modal": -1}},
    ]
    rows = [d async for d in db.units.aggregate(pipe)]
    total_modal = sum(r.get("modal", 0) for r in rows)
    total_jual = sum(r.get("nilai_jual", 0) for r in rows)
    total_unit = sum(r.get("unit", 0) for r in rows)
    return {
        "total_unit": total_unit,
        "total_modal": total_modal,
        "total_nilai_jual": total_jual,
        "estimasi_laba_potensial": total_jual - total_modal,
        "per_merek": [{"merek": r["_id"] or "(tidak diketahui)", "unit": r["unit"], "modal": r["modal"], "nilai_jual": r["nilai_jual"]} for r in rows],
    }


@router.get("/export")
async def export_csv(
    jenis: str = Query(..., description="keuangan|penjualan|pengeluaran"),
    start: Optional[str] = None, end: Optional[str] = None,
    _user=Depends(require_roles(ROLE_OWNER, ROLE_ADMIN)),
):
    from server import db
    s, e = _default_range(start, end)
    buf = io.StringIO()
    writer = csv.writer(buf)

    if jenis == "penjualan":
        orders = await _fetch_orders(db, s, e)
        writer.writerow(["Nomor Pesanan", "Tanggal", "Pelanggan", "Email", "Jumlah Unit", "Subtotal (Omzet)", "HPP", "Laba Kotor", "Biaya Kirim", "Total Dibayar", "Status"])
        for o in orders:
            m = _order_metrics(o)
            try: tanggal = datetime.fromisoformat(o["created_at"]).strftime("%Y-%m-%d %H:%M")
            except Exception: tanggal = o.get("created_at", "")
            writer.writerow([o.get("nomor_pesanan",""), tanggal, o.get("nama_pelanggan",""), o.get("email",""),
                             m["unit_count"], m["omzet"], m["hpp"], m["laba_kotor"], m["biaya_kirim"], o.get("total",0),
                             o.get("status_pesanan","")])
        fname = f"penjualan_{s.strftime('%Y%m%d')}_{e.strftime('%Y%m%d')}.csv"

    elif jenis == "pengeluaran":
        docs = await db.expenses.find({"tanggal": {"$gte": s.strftime('%Y-%m-%d'), "$lte": e.strftime('%Y-%m-%d')}}).to_list(5000)
        writer.writerow(["Tanggal", "Kategori", "Nominal", "Keterangan", "Dibuat Oleh"])
        for x in sorted(docs, key=lambda a: a.get("tanggal","")):
            writer.writerow([x.get("tanggal",""), x.get("kategori",""), x.get("nominal",0), x.get("keterangan",""), x.get("dibuat_oleh","")])
        fname = f"pengeluaran_{s.strftime('%Y%m%d')}_{e.strftime('%Y%m%d')}.csv"

    else:  # keuangan — ringkasan harian
        orders = await _fetch_orders(db, s, e)
        daily: dict[str, dict] = {}
        cur = s.date()
        while cur <= e.date():
            daily[cur.isoformat()] = {"omzet": 0.0, "hpp": 0.0, "laba_kotor": 0.0, "pengeluaran": 0.0, "unit": 0, "pesanan": 0}
            cur += timedelta(days=1)
        for o in orders:
            try: d = datetime.fromisoformat(o["created_at"]).date().isoformat()
            except Exception: continue
            if d not in daily: continue
            m = _order_metrics(o)
            daily[d]["omzet"] += m["omzet"]; daily[d]["hpp"] += m["hpp"]; daily[d]["laba_kotor"] += m["laba_kotor"]
            daily[d]["unit"] += m["unit_count"]; daily[d]["pesanan"] += 1
        exp = await db.expenses.find({"tanggal": {"$gte": s.strftime('%Y-%m-%d'), "$lte": e.strftime('%Y-%m-%d')}}).to_list(5000)
        for x in exp:
            d = x.get("tanggal")
            if d in daily:
                daily[d]["pengeluaran"] += float(x.get("nominal") or 0)
        writer.writerow(["Tanggal", "Pesanan", "Unit Terjual", "Omzet", "HPP", "Laba Kotor", "Pengeluaran", "Laba Bersih"])
        for k in sorted(daily.keys()):
            r = daily[k]
            laba_bersih = r["laba_kotor"] - r["pengeluaran"]
            writer.writerow([k, r["pesanan"], r["unit"], r["omzet"], r["hpp"], r["laba_kotor"], r["pengeluaran"], laba_bersih])
        fname = f"keuangan_{s.strftime('%Y%m%d')}_{e.strftime('%Y%m%d')}.csv"

    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )
