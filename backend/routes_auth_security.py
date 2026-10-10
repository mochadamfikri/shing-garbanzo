"""Email verification and password recovery, single-use 6 digit codes. Public API."""
from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import logging
import secrets

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr, Field
from pymongo import ReturnDocument

from auth import get_jwt_secret, hash_password
from email_service import send_auth_code, is_configured

router = APIRouter(prefix="/api/auth", tags=["auth-security"])
logger = logging.getLogger(__name__)
TTL_MINUTES = 10
THROTTLE_SECONDS = 60
MAX_ATTEMPTS = 5


class EmailPayload(BaseModel):
    email: EmailStr


class VerifyPayload(EmailPayload):
    code: str = Field(pattern=r"^\d{6}$")


class ResetPayload(VerifyPayload):
    new_password: str = Field(min_length=8, max_length=128)


def _hash(email: str, purpose: str, code: str) -> str:
    message = f"{email.lower().strip()}:{purpose}:{code}".encode()
    return hmac.new(get_jwt_secret().encode(), message, hashlib.sha256).hexdigest()


async def issue_code(email: str, purpose: str) -> None:
    from server import db
    if not is_configured():
        raise HTTPException(503, "SMTP belum siap. Hubungi admin toko.")
    email = email.lower().strip()
    now = datetime.now(timezone.utc)
    existing = await db.auth_codes.find_one({"email": email, "purpose": purpose})
    if existing:
        sent_at = existing.get("sent_at")
        if sent_at and (now - sent_at.replace(tzinfo=timezone.utc) if sent_at.tzinfo is None else now - sent_at).total_seconds() < THROTTLE_SECONDS:
            raise HTTPException(429, "Tunggu 60 detik sebelum meminta kode baru")
    code = f"{secrets.randbelow(1000000):06d}"
    doc = {
        "email": email, "purpose": purpose, "code_hash": _hash(email, purpose, code),
        "sent_at": now, "expires_at": now + timedelta(minutes=TTL_MINUTES),
        "attempts": 0,
    }
    await db.auth_codes.replace_one({"email": email, "purpose": purpose}, doc, upsert=True)
    try:
        await send_auth_code(email, code, purpose)
    except Exception:
        logger.exception("Gagal mengirim email keamanan")
        await db.auth_codes.delete_one({"email": email, "purpose": purpose, "code_hash": doc["code_hash"]})
        raise HTTPException(503, "Gagal mengirim email. Periksa SMTP dan coba lagi")


async def consume_code(email: str, purpose: str, code: str) -> None:
    from server import db
    email = email.lower().strip()
    doc = await db.auth_codes.find_one({"email": email, "purpose": purpose})
    now = datetime.now(timezone.utc)
    if not doc:
        raise HTTPException(400, "Kode salah atau sudah kedaluwarsa")
    expiration = doc.get("expires_at")
    if not expiration:
        raise HTTPException(400, "Kode salah atau sudah kedaluwarsa")
    if expiration.tzinfo is None:
        expiration = expiration.replace(tzinfo=timezone.utc)
    if expiration <= now or doc.get("attempts", 0) >= MAX_ATTEMPTS:
        raise HTTPException(400, "Kode kedaluwarsa atau batas percobaan habis. Minta kode baru.")
    key = _hash(email, purpose, code)
    if not hmac.compare_digest(doc["code_hash"], key):
        await db.auth_codes.update_one({"_id": doc["_id"]}, {"$inc": {"attempts": 1}})
        raise HTTPException(400, "Kode salah atau sudah kedaluwarsa")
    result = await db.auth_codes.find_one_and_delete({"_id": doc["_id"], "code_hash": key, "attempts": {"$lt": MAX_ATTEMPTS}})
    if not result:
        raise HTTPException(400, "Kode sudah digunakan. Silakan minta kode baru.")


@router.post("/resend-verification")
async def resend_verification(payload: EmailPayload):
    from server import db
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email, "role": "pelanggan", "email_verified": False})
    if user:
        await issue_code(email, "verify")
    return {"message": "Jika akun menunggu verifikasi, kode akan dikirim ke email tersebut."}


@router.post("/verify-email")
async def verify_email(payload: VerifyPayload):
    from server import db
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email, "role": "pelanggan", "email_verified": False})
    if not user:
        raise HTTPException(400, "Akun tidak ditemukan atau sudah diverifikasi")
    await consume_code(email, "verify", payload.code)
    await db.users.update_one({"id": user["id"]}, {"$set": {"email_verified": True, "email_verified_at": datetime.now(timezone.utc).isoformat()}})
    return {"message": "Email berhasil diverifikasi. Silakan masuk."}


@router.post("/forgot-password")
async def forgot_password(payload: EmailPayload):
    from server import db
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email, "aktif": True})
    if user and user.get("email_verified") is not False:
        await issue_code(email, "reset")
    return {"message": "Jika email terdaftar, kode reset akan dikirim. Silakan periksa inbox/spam."}


@router.post("/reset-password")
async def reset_password(payload: ResetPayload):
    from server import db
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email, "aktif": True})
    if not user or user.get("email_verified") is False:
        raise HTTPException(400, "Kode salah atau sudah kedaluwarsa")
    await consume_code(email, "reset", payload.code)
    await db.users.update_one({"id": user["id"]}, {
        "$set": {"password_hash": hash_password(payload.new_password),
                 "password_reset_at": datetime.now(timezone.utc).isoformat()},
        "$inc": {"token_version": 1}
    })
    return {"message": "Password berhasil diperbarui. Silakan login kembali."}
