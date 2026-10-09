"""Webhook pembayaran (Kasera Pay QRIS). Verifikasi tanda tangan + dedup event."""
import json
import logging

from fastapi import APIRouter, Request, HTTPException

import kasera
from routes_orders import mark_order_paid, release_order_stock
from utils import now_utc

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])

PAID_EVENTS = {"payment.paid", "payment.succeeded", "transaction.paid"}
FAILED_EVENTS = {"payment.expired", "payment.failed", "payment.canceled", "transaction.expired"}


@router.post("/kasera")
async def kasera_webhook(request: Request):
    from server import db
    raw = await request.body()
    signature = request.headers.get("Kasera-Signature-V1", "")
    if not kasera.verify_signature(raw, signature):
        raise HTTPException(status_code=400, detail="Tanda tangan tidak valid")

    try:
        event = json.loads(raw)
    except Exception:
        raise HTTPException(status_code=400, detail="Payload bukan JSON")

    event_id = request.headers.get("Kasera-Event-Id") or event.get("id")
    if not event_id:
        raise HTTPException(status_code=400, detail="Event id tidak ada")

    # Dedup: insert atomic, abaikan duplikat
    try:
        await db.webhook_events.insert_one({"event_id": event_id, "at": now_utc().isoformat()})
    except Exception as e:
        if "duplicate key" in str(e).lower():
            return {"ok": True, "duplicate": True}
        raise

    kind = event.get("type")
    data = event.get("data", {}) or {}
    order_id = data.get("external_id")
    status = (data.get("status") or "").lower()
    if not order_id:
        return {"ok": True}

    order = await db.orders.find_one({"id": order_id})
    if not order:
        return {"ok": True}

    if kind in PAID_EVENTS or status in kasera.PAID_STATUSES:
        await mark_order_paid(db, order, "kasera-webhook")
    elif kind in FAILED_EVENTS or status in kasera.FAILED_STATUSES:
        if order.get("status_pesanan") == "MENUNGGU_BAYAR":
            await release_order_stock(db, order, "kasera-webhook", "QRIS kedaluwarsa/gagal")
            await db.orders.update_one({"id": order_id}, {"$set": {"status_pesanan": "KEDALUWARSA", "status_pembayaran": "DITOLAK", "updated_at": now_utc().isoformat()}})
    return {"ok": True}
