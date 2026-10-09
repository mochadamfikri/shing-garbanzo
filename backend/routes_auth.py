"""Endpoint autentikasi: admin/staf dan pelanggan."""
import uuid
from fastapi import APIRouter, HTTPException, Response, Depends

from auth import (
    verify_password, create_access_token, create_refresh_token,
    set_auth_cookies, clear_auth_cookies, get_current_user, hash_password,
    ROLE_PELANGGAN,
)
from models import LoginRequest, RegisterRequest, UserPublic
from utils import now_utc

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=UserPublic)
async def login(payload: LoginRequest, response: Response):
    from server import db
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not user.get("aktif", True):
        raise HTTPException(status_code=401, detail="Email atau kata sandi salah")
    if not verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Email atau kata sandi salah")

    token_version = user.get("token_version", 0)
    access = create_access_token(user["id"], user["email"], user["role"], token_version)
    refresh = create_refresh_token(user["id"], token_version)
    set_auth_cookies(response, access, refresh)
    return UserPublic(**user)


@router.post("/register", response_model=UserPublic)
async def register(payload: RegisterRequest, response: Response):
    """Registrasi pelanggan baru."""
    from server import db

    if payload.password != payload.konfirmasi_password:
        raise HTTPException(status_code=400, detail="Konfirmasi kata sandi tidak sama")
    if len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Kata sandi minimal 6 karakter")

    email = payload.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="Email sudah terdaftar")

    now_s = now_utc().isoformat()
    consent = {
        "status": bool(payload.setujui_promosi),
        "versi": payload.versi_persetujuan,
        "sumber": "registrasi",
        "saluran": payload.saluran_promosi if payload.setujui_promosi else [],
        "consented_at": now_s if payload.setujui_promosi else None,
        "revoked_at": None,
    }
    user_doc = {
        "id": str(uuid.uuid4()),
        "email": email,
        "password_hash": hash_password(payload.password),
        "nama": payload.nama.strip(),
        "telepon": payload.telepon.strip(),
        "role": ROLE_PELANGGAN,
        "aktif": True,
        "token_version": 0,
        "promo_consent": consent,
        "created_at": now_s,
    }
    await db.users.insert_one(user_doc)

    access = create_access_token(user_doc["id"], user_doc["email"], user_doc["role"], 0)
    refresh = create_refresh_token(user_doc["id"], 0)
    set_auth_cookies(response, access, refresh)
    return UserPublic(**user_doc)


@router.post("/logout")
async def logout(response: Response):
    clear_auth_cookies(response)
    return {"message": "Berhasil keluar"}


@router.get("/me", response_model=UserPublic)
async def me(user=Depends(get_current_user)):
    return UserPublic(**user)
