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
from routes_inventory import router as inventory_router
from routes_uploads import router as uploads_router
from routes_dashboard import router as dashboard_router
from routes_catalog import router as catalog_router
from routes_customer import router as customer_router
from routes_settings import router as settings_router
from routes_orders import router as orders_router
from routes_reports import router as reports_router
from routes_expenses import router as expenses_router

app.include_router(auth_router)
app.include_router(inventory_router)
app.include_router(uploads_router)
app.include_router(dashboard_router)
app.include_router(catalog_router)
app.include_router(customer_router)
app.include_router(settings_router)
app.include_router(orders_router)
app.include_router(reports_router)
app.include_router(expenses_router)

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

    owner_email = os.environ.get("OWNER_EMAIL", "owner@tokohp.id").lower()
    owner_password = os.environ.get("OWNER_PASSWORD", "Admin@12345")
    existing = await db.users.find_one({"email": owner_email})
    if existing is None:
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
        if not verify_password(owner_password, existing.get("password_hash", "")):
            await db.users.update_one(
                {"email": owner_email},
                {"$set": {"password_hash": hash_password(owner_password)}},
            )
            logger.info("Password Owner disinkronkan dari .env")


@app.on_event("shutdown")
async def on_shutdown():
    client.close()
