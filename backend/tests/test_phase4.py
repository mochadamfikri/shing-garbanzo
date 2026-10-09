"""Phase 4 backend tests: Laporan Keuangan, Pengeluaran Operasional, Export CSV."""
import os
import uuid
from datetime import datetime, timedelta
from pathlib import Path

import pytest
import requests


def _load_backend_url():
    env_path = Path("/app/frontend/.env")
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.startswith("REACT_APP_BACKEND_URL="):
                return line.split("=", 1)[1].strip().rstrip("/")
    return os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")


BASE_URL = _load_backend_url()
OWNER_EMAIL = "owner@tokohp.id"
OWNER_PASS = "Admin@12345"


# ------- Fixtures -------
@pytest.fixture(scope="module")
def owner():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PASS})
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def pelanggan():
    email = f"TEST_p4_{uuid.uuid4().hex[:8]}@example.id"
    pw = "Pelanggan@123"
    r = requests.post(f"{BASE_URL}/api/auth/register", json={
        "nama": "P4", "email": email, "telepon": "08123",
        "password": pw, "konfirmasi_password": pw,
    })
    assert r.status_code == 200, r.text
    s = requests.Session()
    s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pw})
    return s


# ------- /api/reports/summary -------
class TestReportsSummary:
    def test_summary_default_range(self, owner):
        r = owner.get(f"{BASE_URL}/api/reports/summary")
        assert r.status_code == 200
        d = r.json()
        for k in ["rentang", "omzet", "hpp", "laba_kotor", "pengeluaran",
                  "laba_bersih", "profit_loss", "unit_terjual",
                  "total_pesanan", "top_produk"]:
            assert k in d, f"missing {k}"
        assert d["profit_loss"] in ("PROFIT", "LOSS")
        assert isinstance(d["top_produk"], list)
        assert "start" in d["rentang"] and "end" in d["rentang"]

    def test_summary_custom_range(self, owner):
        today = datetime.utcnow().date()
        start = (today - timedelta(days=6)).isoformat()
        end = today.isoformat()
        r = owner.get(f"{BASE_URL}/api/reports/summary", params={"start": start, "end": end})
        assert r.status_code == 200
        d = r.json()
        assert d["rentang"]["start"] == start
        assert d["rentang"]["end"] == end

    def test_summary_pelanggan_forbidden(self, pelanggan):
        r = pelanggan.get(f"{BASE_URL}/api/reports/summary")
        assert r.status_code == 403


# ------- /api/reports/timeseries -------
class TestReportsTimeseries:
    def test_timeseries_structure(self, owner):
        r = owner.get(f"{BASE_URL}/api/reports/timeseries")
        assert r.status_code == 200
        d = r.json()
        assert "harian" in d and isinstance(d["harian"], list)
        assert "mingguan_ohlc" in d and isinstance(d["mingguan_ohlc"], list)
        if d["harian"]:
            row = d["harian"][0]
            for k in ["tanggal", "omzet", "hpp", "laba_kotor", "laba_bersih",
                      "pengeluaran", "unit_terjual", "pesanan"]:
                assert k in row, f"harian missing {k}"
        if d["mingguan_ohlc"]:
            w = d["mingguan_ohlc"][0]
            for k in ["open", "high", "low", "close", "volume_unit"]:
                assert k in w, f"ohlc missing {k}"

    def test_timeseries_pelanggan_forbidden(self, pelanggan):
        r = pelanggan.get(f"{BASE_URL}/api/reports/timeseries")
        assert r.status_code == 403


# ------- /api/reports/inventory-value -------
class TestInventoryValue:
    def test_inventory_value_structure(self, owner):
        r = owner.get(f"{BASE_URL}/api/reports/inventory-value")
        assert r.status_code == 200
        d = r.json()
        for k in ["total_unit", "total_modal", "total_nilai_jual",
                  "estimasi_laba_potensial", "per_merek"]:
            assert k in d
        assert isinstance(d["per_merek"], list)

    def test_inventory_value_pelanggan_forbidden(self, pelanggan):
        r = pelanggan.get(f"{BASE_URL}/api/reports/inventory-value")
        assert r.status_code == 403


# ------- /api/expenses -------
class TestExpenses:
    _created_ids = []

    def test_create_expense_valid(self, owner):
        tgl = datetime.utcnow().date().isoformat()
        payload = {"kategori": "LISTRIK", "nominal": 500000, "tanggal": tgl,
                   "keterangan": "TEST listrik bulan ini"}
        r = owner.post(f"{BASE_URL}/api/expenses", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["kategori"] == "LISTRIK"
        assert d["nominal"] == 500000
        assert d["tanggal"] == tgl
        assert d["tanggal_fmt"] and "/" in d["tanggal_fmt"]
        assert "id" in d
        TestExpenses._created_ids.append(d["id"])

    def test_create_invalid_kategori(self, owner):
        tgl = datetime.utcnow().date().isoformat()
        r = owner.post(f"{BASE_URL}/api/expenses", json={
            "kategori": "FOOBAR", "nominal": 1000, "tanggal": tgl})
        assert r.status_code == 400

    def test_create_invalid_nominal(self, owner):
        tgl = datetime.utcnow().date().isoformat()
        r = owner.post(f"{BASE_URL}/api/expenses", json={
            "kategori": "LISTRIK", "nominal": 0, "tanggal": tgl})
        assert r.status_code == 400

    def test_create_invalid_tanggal(self, owner):
        r = owner.post(f"{BASE_URL}/api/expenses", json={
            "kategori": "LISTRIK", "nominal": 1000, "tanggal": "31-12-2026"})
        assert r.status_code == 400

    def test_list_expenses(self, owner):
        r = owner.get(f"{BASE_URL}/api/expenses")
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d, list)
        if TestExpenses._created_ids:
            assert any(x["id"] in TestExpenses._created_ids for x in d)

    def test_list_expenses_filter_kategori(self, owner):
        r = owner.get(f"{BASE_URL}/api/expenses", params={"kategori": "LISTRIK"})
        assert r.status_code == 200
        for x in r.json():
            assert x["kategori"] == "LISTRIK"

    def test_summary_includes_expense(self, owner):
        """After creating expense Rp500k today, summary.pengeluaran should include it; laba_bersih = laba_kotor - pengeluaran."""
        r = owner.get(f"{BASE_URL}/api/reports/summary")
        assert r.status_code == 200
        d = r.json()
        assert d["pengeluaran"] >= 500000
        # laba_bersih = laba_kotor - pengeluaran
        assert abs(d["laba_bersih"] - (d["laba_kotor"] - d["pengeluaran"])) < 0.01

    def test_delete_expense(self, owner):
        if not TestExpenses._created_ids:
            pytest.skip("no expense to delete")
        exp_id = TestExpenses._created_ids[0]
        r = owner.delete(f"{BASE_URL}/api/expenses/{exp_id}")
        assert r.status_code == 200
        # verify gone
        r2 = owner.get(f"{BASE_URL}/api/expenses")
        ids = [x["id"] for x in r2.json()]
        assert exp_id not in ids

    def test_delete_nonexistent_404(self, owner):
        r = owner.delete(f"{BASE_URL}/api/expenses/nonexistent-id-xxx")
        assert r.status_code == 404

    def test_expenses_pelanggan_forbidden(self, pelanggan):
        tgl = datetime.utcnow().date().isoformat()
        r = pelanggan.post(f"{BASE_URL}/api/expenses", json={
            "kategori": "LISTRIK", "nominal": 100, "tanggal": tgl})
        assert r.status_code == 403
        r2 = pelanggan.get(f"{BASE_URL}/api/expenses")
        assert r2.status_code == 403


# ------- /api/reports/export CSV -------
class TestExportCsv:
    def test_export_keuangan(self, owner):
        r = owner.get(f"{BASE_URL}/api/reports/export", params={"jenis": "keuangan"})
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")
        cd = r.headers.get("content-disposition", "")
        assert "attachment" in cd and "keuangan_" in cd and ".csv" in cd
        # verify header row
        first_line = r.text.splitlines()[0]
        assert "Tanggal" in first_line and "Omzet" in first_line

    def test_export_penjualan(self, owner):
        r = owner.get(f"{BASE_URL}/api/reports/export", params={"jenis": "penjualan"})
        assert r.status_code == 200
        assert "penjualan_" in r.headers.get("content-disposition", "")
        assert "Nomor Pesanan" in r.text.splitlines()[0]

    def test_export_pengeluaran(self, owner):
        r = owner.get(f"{BASE_URL}/api/reports/export", params={"jenis": "pengeluaran"})
        assert r.status_code == 200
        assert "pengeluaran_" in r.headers.get("content-disposition", "")
        assert "Kategori" in r.text.splitlines()[0]

    def test_export_pelanggan_forbidden(self, pelanggan):
        r = pelanggan.get(f"{BASE_URL}/api/reports/export", params={"jenis": "keuangan"})
        assert r.status_code == 403
