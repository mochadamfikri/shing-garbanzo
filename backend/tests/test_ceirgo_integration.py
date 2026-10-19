"""Unit tests for CeirGO integration; no external API calls and no real charges."""
import asyncio
import os
import sys
from pathlib import Path

import httpx
import pytest
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import routes_imei_check as mod


def test_no_key_is_activation_required(monkeypatch):
    monkeypatch.delenv("CEIRGO_API_KEY", raising=False)
    monkeypatch.setenv("CEIRGO_ENABLED", "true")
    result = asyncio.run(mod._availability("cek_imei"))
    assert result["state"] == "activation_required"
    assert result["message"] == mod.ACTIVATION_TEXT


def mock_client(monkeypatch, balance, price=1500, service_enabled=True, fail_wallet=0):
    requests = []

    def handler(request):
        requests.append((request.method, request.url.path))
        if request.url.path == "/api/wallet/snap":
            return httpx.Response(fail_wallet, json={"error": True}) if fail_wallet else httpx.Response(
                200, json={"balance": balance, "reserved": 0})
        if request.url.path == "/api/services/cek_imei":
            return httpx.Response(200, json={"data": {"is_active": service_enabled,
                                                       "rule": {"unit_price": price}}})
        if request.url.path == "/api/order":
            return httpx.Response(200, json={"status": "success", "order_id": 321,
                                             "reference_id": "TEST-321",
                                             "result": {"REGISTERED": ["356938035643809"]}})
        raise AssertionError("Unexpected request: " + request.url.path)

    monkeypatch.setenv("CEIRGO_API_KEY", "unit-test-token-not-real")
    monkeypatch.setenv("CEIRGO_ENABLED", "true")
    monkeypatch.setattr(mod, "_client", lambda key: httpx.AsyncClient(
        base_url="https://ceirgo.id", transport=httpx.MockTransport(handler)))
    return requests


def test_insufficient_funds_prevents_order(monkeypatch):
    requests = mock_client(monkeypatch, balance=0)
    response = asyncio.run(mod._availability("cek_imei"))
    assert response["state"] == "activation_required"
    with pytest.raises(HTTPException) as exc:
        asyncio.run(mod.submit_check(mod.CheckRequest(imei="356938035643809"),
                                      {"id": "test-user"}))
    assert exc.value.status_code == 503
    assert exc.value.detail["message"] == mod.ACTIVATION_TEXT
    assert all(method != "POST" for method, _ in requests)


def test_ready_when_funded(monkeypatch):
    requests = mock_client(monkeypatch, balance=2500)
    response = asyncio.run(mod._availability("cek_imei"))
    assert response["state"] == "ready"
    assert response["price"] == 1500
    assert requests == [("GET", "/api/wallet/snap"), ("GET", "/api/services/cek_imei")]


def test_invalid_credentials_activation(monkeypatch):
    mock_client(monkeypatch, balance=0, fail_wallet=401)
    response = asyncio.run(mod._availability("cek_imei"))
    assert response["state"] == "activation_required"


def test_provider_unavailable_is_not_blocked(monkeypatch):
    mock_client(monkeypatch, balance=0, fail_wallet=503)
    response = asyncio.run(mod._availability("cek_imei"))
    assert response["state"] == "provider_unavailable"
    assert "blocked" not in response["message"].lower()


def test_result_only_returns_allowlisted_fields():
    payload = [{"imei": "356938035643809", "status": "VALID",
                "valid_until": "2026-12-31", "imsi": "510010123456789",
                "msisdn": "081234567", "passport": "SECRET"}]
    result = mod._safe_result(payload, "356938035643809", "cek_validity")
    assert result == {"status": "VALID", "valid_until": "2026-12-31"}
    assert mod._safe_result({"UNKNOWN": ["356938035643809"]},
                            "356938035643809", "cek_imei") == {"status": "UNKNOWN"}


def test_no_paid_order_when_disabled(monkeypatch):
    requests = mock_client(monkeypatch, balance=99999)
    monkeypatch.setenv("CEIRGO_ENABLED", "false")
    with pytest.raises(HTTPException) as exc:
        asyncio.run(mod.submit_check(mod.CheckRequest(imei="356938035643809"),
                                      {"id": "test-user"}))
    assert exc.value.detail["state"] == "activation_required"
    assert not requests


def test_bad_imei_rejected_without_provider_contact(monkeypatch):
    requests = mock_client(monkeypatch, balance=99999)
    with pytest.raises(HTTPException) as exc:
        asyncio.run(mod.submit_check(mod.CheckRequest(imei="123456789012345"),
                                      {"id": "test-user"}))
    assert exc.value.status_code == 422
    assert not requests
