"""CeirGO IMEI lookup: staff-only, no paid order until wallet/service are ready.

Credentials live exclusively in the backend env. We never infer blocked/registered
status from a provider failure; only a returned result may supply an IMEI state.
"""
import logging
import math
import os
import re
from typing import Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from auth import ROLE_ADMIN, ROLE_OWNER, ROLE_STAF, require_roles
from utils import validate_imei, now_utc

router = APIRouter(prefix="/api/imei-check", tags=["imei-check"])
logger = logging.getLogger(__name__)

ACTIVATION_TEXT = "Belum bisa digunakan, silakan aktivasi terlebih dahulu."
TEMPORARY_TEXT = "Layanan pengecekan sementara tidak tersedia. Coba lagi nanti."
SERVICE_CODES = {
    "cek_imei": "Status IMEI",
    "cek_sf": "Roamer / SF",
    "cek_digi": "Roamer / DIGI",
    "cek_imei_beacukai": "Registrasi Bea Cukai",
    "cek_validity": "Masa Berlaku IMEI",
}
CheckCode = Literal["cek_imei", "cek_sf", "cek_digi", "cek_imei_beacukai", "cek_validity"]


class CheckRequest(BaseModel):
    imei: str
    service_code: CheckCode = "cek_imei"


def _api_base():
    # Production requests must stay on the official HTTPS host.
    return "https://ceirgo.id"


def _key():
    if os.environ.get("CEIRGO_ENABLED", "true").strip().lower() in {"false", "0", "no"}:
        return None
    return os.environ.get("CEIRGO_API_KEY", "").strip() or None


def _client(key):
    return httpx.AsyncClient(
        base_url=_api_base(),
        timeout=httpx.Timeout(12.0, connect=5.0),
        follow_redirects=False,
        headers={"Authorization": "Bearer " + key, "Accept": "application/json"},
    )


def _provider_error(response):
    # Do not expose response body, provider tokens or internal trace data.
    if response.status_code in (401, 402, 403):
        return HTTPException(503, {"state": "activation_required", "message": ACTIVATION_TEXT})
    if response.status_code == 429:
        return HTTPException(503, {"state": "rate_limited", "message": "Batas pengecekan tercapai, coba lagi nanti."})
    return HTTPException(503, {"state": "provider_unavailable", "message": TEMPORARY_TEXT})


def _json(response):
    try:
        data = response.json()
        if isinstance(data, dict):
            return data
    except ValueError:
        pass
    raise HTTPException(503, {"state": "provider_unavailable", "message": TEMPORARY_TEXT})


def _safe_result(result, imei, service_code):
    """Allowlist only non-sensitive result fields; never pass through IMSI/MSISDN."""
    if service_code in ("cek_imei", "cek_sf", "cek_digi"):
        if not isinstance(result, dict):
            return {"status": "UNKNOWN"}
        buckets = (
            "REGISTERED", "UNREGISTERED", "UNKNOWN", "ROAMER", "SF_ROAMER",
            "DIGI_ROAMER", "BLOCKED", "NO_RECORD", "NO_GIDI", "ERROR",
        )
        for name in buckets:
            if imei in (result.get(name) or []):
                return {"status": name}
        status = str(result.get("status", "")).upper()
        return {"status": status if status in buckets else "UNKNOWN"}
    if isinstance(result, list):
        item = next((i for i in result if isinstance(i, dict) and i.get("imei") == imei), None)
        if item:
            allowed = {"REGISTERED", "UNREGISTERED", "UNKNOWN", "ERROR", "VALID", "EXPIRED", "DUPLICATE"}
            status = str(item.get("status", "UNKNOWN")).upper()
            response = {"status": status if status in allowed else "UNKNOWN"}
            if service_code == "cek_validity":
                value = item.get("valid_until")
                if isinstance(value, str) and len(value) <= 40:
                    response["valid_until"] = value
            return response
    return {"status": "UNKNOWN"}


async def _availability(service_code):
    key = _key()
    if not key:
        return {"state": "activation_required", "message": ACTIVATION_TEXT,
                "service": service_code, "price": None}
    try:
        async with _client(key) as client:
            balance_res = await client.get("/api/wallet/snap")
            if balance_res.status_code != 200:
                raise _provider_error(balance_res)
            balance = _json(balance_res).get("balance")
            service_res = await client.get("/api/services/" + service_code)
            if service_res.status_code != 200:
                raise _provider_error(service_res)
            service = _json(service_res).get("data")
            if not isinstance(service, dict):
                raise HTTPException(503, {"state": "provider_unavailable", "message": TEMPORARY_TEXT})
            rule = service.get("rule")
            if not isinstance(rule, dict):
                raise HTTPException(503, {"state": "provider_unavailable", "message": TEMPORARY_TEXT})
            price = rule.get("unit_price")
            if (not isinstance(price, (int, float)) or isinstance(price, bool)
                    or price < 0 or not isinstance(balance, (int, float))
                    or isinstance(balance, bool) or balance < 0
                    or not math.isfinite(price) or not math.isfinite(balance)):
                raise HTTPException(503, {"state": "provider_unavailable", "message": TEMPORARY_TEXT})
            if not service.get("is_active", False):
                return {"state": "provider_unavailable", "message": TEMPORARY_TEXT,
                        "service": service_code, "price": price}
            if balance < price:
                return {"state": "activation_required", "message": ACTIVATION_TEXT,
                        "service": service_code, "price": price}
            return {"state": "ready", "message": "Layanan siap digunakan.",
                    "service": service_code, "price": price}
    except HTTPException as exc:
        detail = exc.detail if isinstance(exc.detail, dict) else {}
        return {"state": detail.get("state", "provider_unavailable"),
                "message": detail.get("message", TEMPORARY_TEXT),
                "service": service_code, "price": None}
    except (httpx.RequestError, ValueError):
        logger.warning("CeirGO readiness endpoint unavailable")
        return {"state": "provider_unavailable", "message": TEMPORARY_TEXT,
                "service": service_code, "price": None}


@router.get("/status")
async def check_status(service_code: CheckCode = "cek_imei",
                       _user=Depends(require_roles(ROLE_OWNER, ROLE_ADMIN, ROLE_STAF))):
    return await _availability(service_code)


@router.get("/services")
async def service_options(_user=Depends(require_roles(ROLE_OWNER, ROLE_ADMIN, ROLE_STAF))):
    return {"services": [{"code": k, "name": v} for k, v in SERVICE_CODES.items()]}


@router.post("")
async def submit_check(payload: CheckRequest,
                       user=Depends(require_roles(ROLE_OWNER, ROLE_ADMIN, ROLE_STAF))):
    imei = payload.imei.strip()
    if not re.fullmatch(r"[0-9]{15}", imei) or not validate_imei(imei)[0]:
        raise HTTPException(422, "IMEI harus 15 angka dengan checksum valid")
    ready = await _availability(payload.service_code)
    if ready["state"] != "ready":
        raise HTTPException(503, {"state": ready["state"], "message": ready["message"]})
    key = _key()
    if not key:
        raise HTTPException(503, {"state": "activation_required", "message": ACTIVATION_TEXT})
    try:
        async with _client(key) as client:
            # No automatic retries: retrying a paid POST could charge twice.
            response = await client.post("/api/order", json={
                "code": payload.service_code, "data": {"imeis": [imei]}
            })
        if response.status_code not in (200, 201):
            raise _provider_error(response)
        data = _json(response)
    except HTTPException:
        raise
    except httpx.RequestError:
        logger.warning("CeirGO paid order outcome uncertain; check provider order history")
        raise HTTPException(503, {"state": "outcome_unknown",
                                  "message": "Status transaksi belum dapat dipastikan. Periksa riwayat CeirGO sebelum mengulangi."})
    order_status = str(data.get("status", "")).lower()
    if order_status not in {"success", "partial", "failed", "pending"}:
        raise HTTPException(503, {"state": "outcome_unknown",
                                  "message": "Respons transaksi tidak dikenali. Periksa riwayat CeirGO."})
    order_id = data.get("order_id")
    if not isinstance(order_id, int) or order_id < 1:
        raise HTTPException(503, {"state": "outcome_unknown",
                                  "message": "ID transaksi tidak tersedia. Periksa riwayat CeirGO."})
    # The order belongs to this authenticated staff member; save no sensitive response.
    from server import db
    await db.imei_check_orders.update_one(
        {"order_id": order_id},
        {"$setOnInsert": {"order_id": order_id, "user_id": user["id"],
                           "service_code": payload.service_code,
                           "imei_last4": imei[-4:], "created_at": now_utc().isoformat()}},
        upsert=True,
    )
    return {"state": "processed" if order_status in {"success", "partial"} else order_status,
            "provider_status": order_status,
            "order_id": order_id, "reference_id": data.get("reference_id"),
            "service_code": payload.service_code,
            "result": _safe_result(data.get("result"), imei, payload.service_code)
                     if order_status in {"success", "partial"} else None,
            "message": "Pengecekan diproses." if order_status == "pending" else
                       ("Pengecekan selesai." if order_status in {"success", "partial"} else "Pengecekan gagal.")}


@router.get("/orders/{order_id}")
async def check_order(order_id: int,
                      user=Depends(require_roles(ROLE_OWNER, ROLE_ADMIN, ROLE_STAF))):
    from server import db
    record = await db.imei_check_orders.find_one({"order_id": order_id, "user_id": user["id"]})
    if not record:
        raise HTTPException(404, "Transaksi tidak ditemukan")
    key = _key()
    if not key:
        raise HTTPException(503, {"state": "activation_required", "message": ACTIVATION_TEXT})
    try:
        async with _client(key) as client:
            response = await client.get("/api/order/" + str(order_id))
        if response.status_code != 200:
            raise _provider_error(response)
        data = _json(response).get("data") or {}
    except HTTPException:
        raise
    except httpx.RequestError:
        raise HTTPException(503, {"state": "provider_unavailable", "message": TEMPORARY_TEXT})
    status = str(data.get("status", "")).lower()
    # CeirGO order detail returns 'completed' where create order returns 'success'.
    final = status in {"completed", "partial"}
    # Store only last4; read the exact submitted IMEI from provider input, never expose it as-is.
    imeis = (data.get("input_payload") or {}).get("imeis") or []
    imei = imeis[0] if len(imeis) == 1 and isinstance(imeis[0], str) else ""
    if imei[-4:] != record["imei_last4"]:
        raise HTTPException(503, {"state": "provider_unavailable", "message": TEMPORARY_TEXT})
    return {"state": "processed" if final else ("failed" if status in {"failed", "cancelled"} else "pending"),
            "provider_status": status, "order_id": order_id, "reference_id": data.get("reference_id"),
            "service_code": record["service_code"],
            "result": _safe_result(data.get("result_payload"), imei, record["service_code"]) if final else None,
            "message": "Pengecekan selesai." if final else ("Pengecekan gagal." if status in {"failed", "cancelled"} else "Pengecekan masih diproses.")}
