"""Dashboard admin: statistik stok, modal, dan agregasi dasar."""
from fastapi import APIRouter, Depends

from auth import require_roles, ROLE_OWNER, ROLE_ADMIN, ROLE_STAF, FINANCE_ROLES

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/summary")
async def summary(user=Depends(require_roles(ROLE_OWNER, ROLE_ADMIN, ROLE_STAF))):
    from server import db
    pipeline = [
        {"$group": {
            "_id": "$status_stok",
            "count": {"$sum": 1},
            "modal": {"$sum": {"$add": [
                {"$ifNull": ["$harga_beli", 0]},
                {"$ifNull": ["$biaya_reparasi", 0]},
                {"$ifNull": ["$biaya_tambahan", 0]},
            ]}},
            "nilai_jual": {"$sum": {"$ifNull": ["$harga_jual", 0]}},
        }}
    ]
    by_status = {d["_id"]: d async for d in db.units.aggregate(pipeline)}

    total_unit = sum(x.get("count", 0) for x in by_status.values())
    tersedia = by_status.get("TERSEDIA", {}).get("count", 0)
    hold = by_status.get("HOLD", {}).get("count", 0)
    terjual = by_status.get("TERJUAL", {}).get("count", 0)
    servis = by_status.get("SERVIS", {}).get("count", 0)
    arsip = by_status.get("DIARSIPKAN", {}).get("count", 0)

    # Modal stok aktif (hanya unit yang belum terjual)
    nilai_modal_stok = by_status.get("TERSEDIA", {}).get("modal", 0) + by_status.get("HOLD", {}).get("modal", 0)
    nilai_jual_stok = by_status.get("TERSEDIA", {}).get("nilai_jual", 0) + by_status.get("HOLD", {}).get("nilai_jual", 0)
    estimasi_laba_potensial = nilai_jual_stok - nilai_modal_stok

    # Realisasi Penjualan & Laba Riil dari POS
    pos_pipe = [
        {"$match": {"status": "SELESAI"}},
        {"$group": {
            "_id": None,
            "total_omzet": {"$sum": "$penjualan_bersih"},
            "total_hpp": {"$sum": "$hpp"},
            "total_laba_kotor": {"$sum": "$laba_kotor"},
            "total_laba_bersih": {"$sum": "$laba_bersih"},
            "total_transaksi": {"$sum": 1}
        }}
    ]
    pos_res = await db.pos_sales.aggregate(pos_pipe).to_list(1)
    pos_stat = pos_res[0] if pos_res else {}

    total_omzet = pos_stat.get("total_omzet", 0)
    total_hpp_terjual = pos_stat.get("total_hpp", 0)
    total_laba_kotor_terjual = pos_stat.get("total_laba_kotor", 0)
    total_laba_bersih_terjual = pos_stat.get("total_laba_bersih", 0)

    # Produk terlaris (TERJUAL) by merek
    merek_pipe = [
        {"$match": {"status_stok": "TERJUAL"}},
        {"$group": {"_id": "$merek", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 5},
    ]
    performa_merek = [d async for d in db.units.aggregate(merek_pipe)]

    hide_finance = user["role"] not in FINANCE_ROLES
    data = {
        "total_unit": total_unit,
        "tersedia": tersedia,
        "hold": hold,
        "terjual": terjual,
        "servis": servis,
        "arsip": arsip,
        "nilai_modal_stok": 0 if hide_finance else nilai_modal_stok,
        "nilai_jual_stok": nilai_jual_stok,
        "estimasi_laba_potensial": 0 if hide_finance else estimasi_laba_potensial,
        "total_omzet": total_omzet,
        "total_hpp_terjual": 0 if hide_finance else total_hpp_terjual,
        "total_laba_kotor_terjual": 0 if hide_finance else total_laba_kotor_terjual,
        "total_laba_bersih_terjual": 0 if hide_finance else total_laba_bersih_terjual,
        "performa_merek": performa_merek,
    }
    return data


@router.get("/audit-logs")
async def audit_logs(limit: int = 50, _user=Depends(require_roles(ROLE_OWNER, ROLE_ADMIN))):
    from server import db
    cursor = db.audit_logs.find({}, {"_id": 0}).sort("at", -1).limit(limit)
    return await cursor.to_list(limit)
