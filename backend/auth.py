"""JWT custom authentication, bcrypt hashing, role-based dependency.
Mengikuti playbook integration_playbook_expert_v2."""
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from fastapi import HTTPException, Request, status

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 12  # 12 jam, panel admin internal
REFRESH_TOKEN_EXPIRE_DAYS = 7

ROLE_OWNER = "owner"
ROLE_ADMIN = "admin"
ROLE_STAF = "staf"
ROLE_PELANGGAN = "pelanggan"
ALL_ROLES = {ROLE_OWNER, ROLE_ADMIN, ROLE_STAF, ROLE_PELANGGAN}
STAFF_ROLES = {ROLE_OWNER, ROLE_ADMIN, ROLE_STAF}
FINANCE_ROLES = {ROLE_OWNER, ROLE_ADMIN}


def get_jwt_secret() -> str:
    secret = os.environ.get("JWT_SECRET")
    if not secret:
        raise RuntimeError("JWT_SECRET belum di-set di .env")
    return secret


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str, role: str, token_version: int = 0) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "ver": token_version,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
        "type": "access",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str, token_version: int = 0) -> str:
    payload = {
        "sub": user_id,
        "ver": token_version,
        "exp": datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        "type": "refresh",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def set_auth_cookies(response, access_token: str, refresh_token: Optional[str] = None) -> None:
    response.set_cookie(
        key="access_token", value=access_token, httponly=True, secure=True,
        samesite="none", max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60, path="/",
    )
    if refresh_token:
        response.set_cookie(
            key="refresh_token", value=refresh_token, httponly=True, secure=True,
            samesite="none", max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600, path="/",
        )


def clear_auth_cookies(response) -> None:
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")


def _extract_token(request: Request) -> Optional[str]:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    return token


async def get_current_user(request: Request):
    """FastAPI dependency: ambil user dari cookie/bearer, verifikasi di DB."""
    from server import db  # late import untuk hindari siklus
    token = _extract_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Belum login")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Tipe token tidak valid")
        user = await db.users.find_one({"id": payload["sub"]})
        if not user:
            raise HTTPException(status_code=401, detail="Pengguna tidak ditemukan")
        if payload.get("ver", 0) != user.get("token_version", 0):
            raise HTTPException(status_code=401, detail="Sesi berakhir, silakan login ulang")
        user.pop("_id", None)
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token sudah kedaluwarsa")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token tidak valid")


def require_roles(*roles: str):
    """Dependency factory untuk gate role di endpoint."""
    allowed = set(roles)

    async def _dep(request: Request):
        user = await get_current_user(request)
        if user.get("role") not in allowed:
            raise HTTPException(status_code=403, detail="Hak akses tidak mencukupi")
        return user

    return _dep
