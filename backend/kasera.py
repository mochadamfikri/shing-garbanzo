"""Integrasi Kasera Pay - QRIS (Direct API). https://pay.kasera.id/docs/api
Semua panggilan server-side. API key & webhook secret dari environment."""
import os
import time
import hmac
import hashlib

import httpx

KASERA_BASE = os.environ.get("KASERA_BASE_URL", "https://pay.kasera.id").rstrip("/")


def _api_key() -> str:
    key = os.environ.get("KASERA_API_KEY")
    if not key:
        raise RuntimeError("KASERA_API_KEY belum di-set di .env")
    return key


def is_configured() -> bool:
    return bool(os.environ.get("KASERA_API_KEY"))


def _client() -> httpx.AsyncClient:
    return httpx.AsyncClient(
        base_url=KASERA_BASE,
        headers={
            "Authorization": f"Bearer {_api_key()}",
            "Content-Type": "application/json",
        },
        timeout=20,
    )


async def create_qris(order_id: str, amount: int, description: str, idempotency_key: str) -> dict:
    """Buat transaksi QRIS. Mengembalikan payload Kasera (id, status, payment.qr_string, expires_at)."""
    payload = {
        "amount": int(amount),
        "description": description,
        "external_id": order_id,
        "payment_methods": ["qris"],
    }
    async with _client() as c:
        r = await c.post("/v1/transactions", json=payload,
                         headers={"Idempotency-Key": idempotency_key})
        r.raise_for_status()
        return r.json()


async def get_transaction(kasera_id: str) -> dict:
    async with _client() as c:
        r = await c.get(f"/v1/transactions/{kasera_id}")
        r.raise_for_status()
        return r.json()


def verify_signature(raw: bytes, header: str, tolerance: int = 300) -> bool:
    """Verifikasi Kasera-Signature-V1: 't=<unix>,v1=<hex>[,v1=<old-hex>]' menandai timestamp + '.' + rawBody."""
    secret = os.environ.get("KASERA_WEBHOOK_SECRET")
    if not secret or not header:
        return False
    parts = [x.strip() for x in header.split(",")]
    if not parts or not parts[0].startswith("t="):
        return False
    try:
        ts = int(parts[0][2:])
    except ValueError:
        return False
    if abs(time.time() - ts) > tolerance:
        return False
    expected = hmac.new(secret.encode(), f"{ts}.".encode() + raw, hashlib.sha256).hexdigest()
    return any(p.startswith("v1=") and hmac.compare_digest(p[3:], expected) for p in parts[1:])


# Status Kasera yang dianggap LUNAS
PAID_STATUSES = {"succeeded", "paid", "completed"}
FAILED_STATUSES = {"expired", "failed", "canceled", "cancelled"}


def friendly_error(exc) -> str:
    """Ubah error Kasera menjadi pesan Indonesia yang jelas untuk pelanggan."""
    code = ""
    message = ""
    resp = getattr(exc, "response", None)
    if resp is not None:
        try:
            err = resp.json().get("error", {})
            code = err.get("code", "")
            message = err.get("message", "")
        except Exception:
            pass
    mapping = {
        "amount_too_large": "Nominal pesanan melebihi batas maksimum QRIS. Silakan pilih metode Transfer Bank untuk pesanan ini.",
        "amount_too_small": "Nominal pesanan di bawah batas minimum QRIS.",
    }
    return mapping.get(code, message or "Gagal membuat QRIS. Silakan coba lagi atau gunakan metode pembayaran lain.")
