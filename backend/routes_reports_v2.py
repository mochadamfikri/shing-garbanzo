"""Analitik V2: gabungan transaksi POS dan pesanan online terbayar."""
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Depends, Query, HTTPException
from auth import require_roles, ROLE_OWNER, ROLE_ADMIN
from utils import now_utc

router = APIRouter(prefix="/api/reports/v2", tags=["reports-v2"])
WIB = ZoneInfo("Asia/Jakarta")
REALIZED = ["DIPROSES","DIKIRIM","SELESAI"]

def _rupiah(value):
    return round(float(value or 0))

@router.get("/summary")
async def summary(start: str = Query(default=None), end: str = Query(default=None),
                  user=Depends(require_roles(ROLE_OWNER, ROLE_ADMIN))):
    from server import db
    try:
        today = datetime.now(WIB).date()
        first = datetime.fromisoformat(start).date() if start else today - timedelta(days=29)
        last = datetime.fromisoformat(end).date() if end else today
        if last < first or (last-first).days > 365:
            raise ValueError()
    except ValueError:
        raise HTTPException(status_code=422, detail="Rentang tanggal tidak valid atau melebihi 365 hari")
    def within(value):
        if not value: return False
        try:
            parsed = datetime.fromisoformat(value) if isinstance(value,str) else value
            if parsed.tzinfo is None: parsed=parsed.replace(tzinfo=timezone.utc)
            return first <= parsed.astimezone(WIB).date() <= last
        except (ValueError, TypeError): return False
    pos = await db.pos_sales.find({"status":"SELESAI"}).to_list(length=20000)
    online = await db.orders.find({"status_pesanan":{"$in":REALIZED},"status_pembayaran":"DITERIMA"}).to_list(length=20000)
    expenses=await db.expenses.find({"tanggal":{"$gte":first.isoformat(),"$lte":last.isoformat()}}).to_list(length=20000)
    metrics={"omzet":0,"hpp":0,"laba_kotor":0,"biaya_transaksi":0,"pengeluaran":0,"laba_bersih":0,"unit_terjual":0,"total_transaksi":0,"pos":0,"online":0}
    daily=defaultdict(lambda:{"tanggal":"","omzet":0,"pos":0,"online":0,"unit_terjual":0})
    products=defaultdict(lambda:{"unit":0,"omzet":0})
    def add_sale(kanal, date, netto, modal, count, fees, lines):
        metrics["omzet"]+=netto
        metrics["hpp"]+=modal
        metrics["biaya_transaksi"]+=fees
        metrics["unit_terjual"]+=count
        metrics["total_transaksi"]+=1
        metrics[kanal]+=netto
        day=date.astimezone(WIB).date().isoformat()
        daily[day]["tanggal"]=day
        daily[day]["omzet"]+=netto
        daily[day][kanal]+=netto
        daily[day]["unit_terjual"]+=count
        for item in lines:
            name=f"{item.get('merek','')} {item.get('model','')}".strip()
            products[name]["unit"]+=1
            products[name]["omzet"]+=_rupiah(item.get("harga_akhir",item.get("harga_jual")))
    def date_from(v):
        d=datetime.fromisoformat(v) if isinstance(v,str) else v
        return d.replace(tzinfo=timezone.utc) if d.tzinfo is None else d
    for row in pos:
        when=row.get("tanggal_jual")
        if not within(when): continue
        add_sale("pos",date_from(when),_rupiah(row.get("penjualan_bersih")),_rupiah(row.get("hpp")),len(row.get("items",[])),_rupiah(row.get("biaya_transaksi")),row.get("items",[]))
    for row in online:
        when=row.get("paid_at") or row.get("qris_paid_at") or row.get("updated_at") or row.get("created_at")
        if not within(when): continue
        items=row.get("items",[])
        add_sale("online",date_from(when),_rupiah(row.get("subtotal")),sum(_rupiah(x.get("modal")) for x in items),len(items),0,items)
    metrics["pengeluaran"]=sum(_rupiah(x.get("nominal")) for x in expenses)
    metrics["laba_kotor"]=metrics["omzet"]-metrics["hpp"]
    metrics["laba_bersih"]=metrics["laba_kotor"]-metrics["biaya_transaksi"]-metrics["pengeluaran"]
    metrics["margin_persen"]=round(metrics["laba_bersih"]/metrics["omzet"]*100,2) if metrics["omzet"] else 0
    return {"rentang":{"start":first.isoformat(),"end":last.isoformat()},"metrics":metrics,
            "harian":sorted(daily.values(),key=lambda x:x["tanggal"]),
            "produk_terlaris":sorted([{"produk":k,**v} for k,v in products.items()],key=lambda x:-x["unit"])[:10],
            "catatan":"Data online lama tanpa paid_at memakai waktu pembaruan/pembuatan; perlu migrasi tanggal realisasi untuk laporan historis presisi."}
