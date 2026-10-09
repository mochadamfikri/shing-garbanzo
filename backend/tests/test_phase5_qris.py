"""Phase 5 - Admin Riwayat Pembayaran QRIS + Notifikasi."""
import os
import pytest
import requests
from datetime import datetime, timezone

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://toko-hp-dev.preview.emergentagent.com").rstrip("/")
OWNER_EMAIL = "owner@tokohp.id"
OWNER_PASSWORD = "Admin@12345"
TODAY = datetime.now(timezone.utc).strftime("%Y-%m-%d")


@pytest.fixture(scope="module")
def owner_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PASSWORD})
    assert r.status_code == 200, r.text
    assert s.cookies.get("access_token"), "access_token cookie missing"
    return s


@pytest.fixture
def auth_headers(owner_session):
    # Return the session as a "headers" surrogate - tests use it via requests method calls
    return owner_session


# ---------- Riwayat Pembayaran QRIS ----------
class TestRiwayatQRIS:
    def test_list_all(self, auth_headers):
        r = auth_headers.get(f"{BASE_URL}/api/orders/admin/pembayaran-qris")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        nomors = {d["nomor_pesanan"] for d in data}
        assert "ORD-SEED-A" in nomors
        assert "ORD-SEED-B" in nomors

    def test_filter_today_only(self, auth_headers):
        r = auth_headers.get(f"{BASE_URL}/api/orders/admin/pembayaran-qris", params={"start": TODAY, "end": TODAY})
        assert r.status_code == 200
        data = r.json()
        nomors = {d["nomor_pesanan"] for d in data}
        assert "ORD-SEED-A" in nomors
        assert "ORD-SEED-B" not in nomors

    def test_filter_empty_range(self, auth_headers):
        r = auth_headers.get(f"{BASE_URL}/api/orders/admin/pembayaran-qris", params={"start": "2020-01-01", "end": "2020-01-31"})
        assert r.status_code == 200
        assert r.json() == []

    def test_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/orders/admin/pembayaran-qris")
        assert r.status_code in (401, 403)


# ---------- CSV Export ----------
class TestCSVExport:
    def test_csv_content_type_and_header(self, auth_headers):
        r = auth_headers.get(f"{BASE_URL}/api/orders/admin/pembayaran-qris/csv")
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")
        assert "attachment" in r.headers.get("content-disposition", "").lower()
        lines = r.text.splitlines()
        assert lines[0].strip().startswith("Nomor Pesanan,Waktu Bayar,Nominal,Status,Kasera ID")
        # at least 1 data row (seeds exist)
        assert len(lines) >= 2
        body = "\n".join(lines)
        assert "ORD-SEED-A" in body

    def test_csv_with_filter(self, auth_headers):
        r = auth_headers.get(f"{BASE_URL}/api/orders/admin/pembayaran-qris/csv", params={"start": TODAY, "end": TODAY})
        assert r.status_code == 200
        body = r.text
        assert "ORD-SEED-A" in body
        assert "ORD-SEED-B" not in body

    def test_csv_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/orders/admin/pembayaran-qris/csv")
        assert r.status_code in (401, 403)


# ---------- Notifikasi ----------
class TestNotifikasi:
    def test_list_notifikasi(self, auth_headers):
        r = auth_headers.get(f"{BASE_URL}/api/orders/admin/notifikasi")
        assert r.status_code == 200
        d = r.json()
        assert "count" in d and "items" in d
        assert d["count"] >= 2
        assert isinstance(d["items"], list)
        assert all("nomor_pesanan" in i for i in d["items"])

    def test_notifikasi_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/orders/admin/notifikasi")
        assert r.status_code in (401, 403)

    def test_mark_read_and_verify(self, auth_headers):
        # Run last - will zero out count
        r = auth_headers.post(f"{BASE_URL}/api/orders/admin/notifikasi/baca")
        assert r.status_code == 200
        # Verify count = 0
        r2 = auth_headers.get(f"{BASE_URL}/api/orders/admin/notifikasi")
        assert r2.status_code == 200
        assert r2.json()["count"] == 0


# ---------- Settings public (ensure QRIS still enabled) ----------
class TestSettingsPublic:
    def test_qris_merchant_enabled(self):
        r = requests.get(f"{BASE_URL}/api/settings/public")
        assert r.status_code == 200
        data = r.json()
        # metode pembayaran should include qris_merchant active
        s = str(data).lower()
        assert "qris_merchant" in s or "qris" in s
