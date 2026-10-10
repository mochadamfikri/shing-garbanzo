"""Owner/Admin-only user analytics and safe CSV exports."""
import csv
import io
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends
from fastapi.responses import Response
from auth import require_roles, ROLE_OWNER, ROLE_ADMIN

router=APIRouter(prefix="/api/admin/users",tags=["users-admin"])

def safe_cell(v):
    value=str(v if v is not None else "")
    return "'"+value if value.lstrip().startswith(("=","+","-","@","\t","\r")) else value

@router.get("/summary")
async def summary(user=Depends(require_roles(ROLE_OWNER, ROLE_ADMIN))):
    from server import db
    now=datetime.now(timezone.utc)
    since_30=(now-timedelta(days=30)).isoformat()
    since_7=(now-timedelta(days=7)).isoformat()
    return {
        "total_user":await db.users.count_documents({}),
        "pelanggan":await db.users.count_documents({"role":"pelanggan"}),
        "staf_admin":await db.users.count_documents({"role":{"$in":["owner","admin","staf"]}}),
        "verified":await db.users.count_documents({"role":"pelanggan","email_verified":True}),
        "unverified":await db.users.count_documents({"role":"pelanggan","email_verified":False}),
        "pelanggan_baru_7_hari":await db.users.count_documents({"role":"pelanggan","created_at":{"$gte":since_7}}),
        "pelanggan_baru_30_hari":await db.users.count_documents({"role":"pelanggan","created_at":{"$gte":since_30}})
    }

@router.get("/export")
async def export_users(user=Depends(require_roles(ROLE_OWNER, ROLE_ADMIN))):
    from server import db
    doc=io.StringIO()
    out=csv.writer(doc)
    out.writerow(["Nama","Email","Telepon","Role","Status Akun","Verifikasi Email","Tanggal Daftar","Izin Promosi"])
    cursor=db.users.find({},{"_id":0,"nama":1,"email":1,"telepon":1,"role":1,"aktif":1,"email_verified":1,"created_at":1,"promo_consent":1}).sort("created_at",-1)
    async for item in cursor:
        row=[
            item.get("nama",""),item.get("email",""),item.get("telepon",""),item.get("role",""),
            "Aktif" if item.get("aktif",True) else "Nonaktif",
            "Belum" if item.get("email_verified") is False else ("Sudah" if item.get("email_verified") else "Legacy"),
            item.get("created_at",""),"Ya" if item.get("promo_consent",{}).get("status") else "Tidak"
        ]
        out.writerow([safe_cell(x) for x in row])
    return Response(
       content="\ufeff"+doc.getvalue(),media_type="text/csv; charset=utf-8",
       headers={"Content-Disposition":"attachment; filename=pelanggan_sadam_gadget.csv","Cache-Control":"no-store"}
    )
