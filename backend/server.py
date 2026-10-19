"""Entry utama FastAPI - Sistem Manajemen Toko HP."""
import os
import uuid
import logging
from pathlib import Path

from dotenv import load_dotenv
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from motor.motor_asyncio import AsyncIOMotorClient

from auth import hash_password, verify_password, ROLE_OWNER
from utils import now_utc

# --- Mongo ---
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

# --- FastAPI ---
app = FastAPI(title="Sistem Manajemen Toko HP")

# CORS
origins_env = os.environ.get("CORS_ORIGINS", "*")
if origins_env.strip() == "*":
    cors_kwargs = {"allow_origins": ["*"], "allow_credentials": False}
else:
    cors_kwargs = {"allow_origins": [o.strip() for o in origins_env.split(",") if o.strip()], "allow_credentials": True}

app.add_middleware(
    CORSMiddleware, allow_methods=["*"], allow_headers=["*"], **cors_kwargs,
)

# Static uploads - mount pada sub-path agar tidak bentrok dengan POST /api/uploads/*
upload_dir = os.environ.get("STORAGE_LOCAL_DIR", str(ROOT_DIR / "uploads"))
Path(upload_dir).mkdir(parents=True, exist_ok=True)
app.mount("/api/uploads/files", StaticFiles(directory=upload_dir), name="uploads")

# Routers
from routes_auth import router as auth_router
from routes_auth_security import router as auth_security_router
from routes_admin_users import router as admin_users_router
from routes_inventory import router as inventory_router
from routes_uploads import router as uploads_router
from routes_dashboard import router as dashboard_router
from routes_catalog import router as catalog_router
from routes_customer import router as customer_router
from routes_settings import router as settings_router
from routes_orders import router as orders_router
from routes_reports import router as reports_router
from routes_expenses import router as expenses_router
from routes_pos import router as pos_router
from routes_reports_v2 import router as reports_v2_router
from routes_payments import router as payments_router
from routes_imei_check import router as imei_check_router

app.include_router(auth_router)
app.include_router(auth_security_router)
app.include_router(admin_users_router)
app.include_router(inventory_router)
app.include_router(uploads_router)
app.include_router(dashboard_router)
app.include_router(catalog_router)
app.include_router(customer_router)
app.include_router(settings_router)
app.include_router(orders_router)
app.include_router(reports_router)
app.include_router(expenses_router)
app.include_router(pos_router)
app.include_router(reports_v2_router)
app.include_router(payments_router)
app.include_router(imei_check_router)

# Logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


# --- Health ---
@app.get("/api/")
async def root():
    return {"message": "Sistem Manajemen Toko HP - API aktif"}


@app.get("/api/health")
async def health():
    try:
        await db.command("ping")
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "detail": str(e)}


# --- Startup: indexes + seed owner ---
@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.auth_codes.create_index([("email", 1), ("purpose", 1)], unique=True)
    await db.auth_codes.create_index("expires_at", expireAfterSeconds=0)
    await db.users.create_index("id", unique=True)
    await db.units.create_index("id", unique=True)
    await db.units.create_index("imei_1")
    await db.units.create_index("imei_2")
    await db.units.create_index("status_stok")
    await db.units.create_index("status_publikasi")
    await db.audit_logs.create_index([("at", -1)])
    await db.addresses.create_index("user_id")
    await db.addresses.create_index("id", unique=True)
    await db.carts.create_index("user_id", unique=True)
    await db.orders.create_index("id", unique=True)
    await db.orders.create_index("nomor_pesanan", unique=True)
    await db.orders.create_index("user_id")
    await db.orders.create_index("status_pesanan")
    await db.settings.create_index("id", unique=True)
    await db.expenses.create_index("id", unique=True)
    await db.expenses.create_index("tanggal")
    await db.pos_sales.create_index("id", unique=True)
    await db.pos_sales.create_index("idempotency_key", unique=True)
    await db.pos_sales.create_index("tanggal_jual")
    await db.webhook_events.create_index("event_id", unique=True)
    await db.imei_check_orders.create_index("order_id", unique=True)

    owner_email = os.environ.get("OWNER_EMAIL", "owner@tokohp.id").lower()
    owner_password = os.environ.get("OWNER_PASSWORD")
    existing = await db.users.find_one({"email": owner_email})
    if existing is None:
        if not owner_password:
            raise RuntimeError("OWNER_PASSWORD wajib ditentukan sebelum membuat Owner")
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": owner_email,
            "password_hash": hash_password(owner_password),
            "nama": "Pemilik Toko",
            "role": ROLE_OWNER,
            "aktif": True,
            "token_version": 0,
            "created_at": now_utc().isoformat(),
        })
        logger.info("Seed Owner dibuat: %s", owner_email)
    else:
        # Akun yang sudah ada tidak direset saat proses restart.
        pass


@app.on_event("shutdown")
async def on_shutdown():
    client.close()
