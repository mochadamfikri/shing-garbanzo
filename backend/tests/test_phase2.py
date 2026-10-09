"""Phase 2 backend tests: catalog publik, registrasi, alamat, consent, keranjang, history inventaris."""
import os
import uuid
import pytest
import requests
from pathlib import Path


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


def _luhn(partial14: str) -> str:
    s = 0
    for i, c in enumerate(reversed(partial14)):
        n = int(c)
        if i % 2 == 0:
            n *= 2
            if n > 9:
                n -= 9
        s += n
    chk = (10 - (s % 10)) % 10
    return partial14 + str(chk)


@pytest.fixture(scope="module")
def owner_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PASS})
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def tayang_unit(owner_session):
    """Create a unit and set TAYANG + TERSEDIA. Return its id and body."""
    base_imei = "35693803564" + str(uuid.uuid4().int)[:3]
    imei = _luhn(base_imei[:14])
    payload = {
        "merek": "Apple", "model": "iPhone 13", "varian": "128GB",
        "ram": "4GB", "penyimpanan": "128GB", "warna": "Midnight",
        "jenis_perangkat": "INTER", "kondisi": "BEKAS", "grade_fisik": "A",
        "kesehatan_baterai": 92, "imei_1": imei,
        "kelengkapan": "Fullset", "garansi": "Toko 30 hari",
        "harga_beli": 7500000, "biaya_reparasi": 0, "biaya_tambahan": 0,
        "harga_jual": 9000000, "deskripsi": "TEST unit untuk katalog",
        "foto_urls": ["https://example.com/f.jpg"],
        "status_stok": "TERSEDIA", "status_publikasi": "DRAFT",
        "produk_unggulan": True,
    }
    r = owner_session.post(f"{BASE_URL}/api/inventory", json=payload)
    assert r.status_code in (200, 201), r.text
    unit = r.json()
    uid = unit["id"]
    # publish
    pr = owner_session.patch(f"{BASE_URL}/api/inventory/{uid}", json={"status_publikasi": "TAYANG"})
    assert pr.status_code == 200, pr.text
    return pr.json()


# ---------- CATALOG ----------
class TestCatalog:
    def test_list_catalog_public_no_auth(self, tayang_unit):
        r = requests.get(f"{BASE_URL}/api/catalog")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        found = next((i for i in data if i["id"] == tayang_unit["id"]), None)
        assert found is not None, "Tayang unit should appear in catalog"
        # Pastikan field sensitif TIDAK ada
        for forbidden in ["imei_1", "imei_2", "harga_beli", "biaya_reparasi", "biaya_tambahan", "supplier", "serial_number"]:
            assert forbidden not in found, f"{forbidden} must not leak in catalog"
        assert found["harga_jual"] == 9000000
        assert found["tersedia"] is True

    def test_featured(self, tayang_unit):
        r = requests.get(f"{BASE_URL}/api/catalog/featured")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)

    def test_brands(self, tayang_unit):
        r = requests.get(f"{BASE_URL}/api/catalog/brands")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert any(d.get("merek") == "Apple" for d in data)

    def test_catalog_detail_ok(self, tayang_unit):
        r = requests.get(f"{BASE_URL}/api/catalog/{tayang_unit['id']}")
        assert r.status_code == 200
        d = r.json()
        assert d["id"] == tayang_unit["id"]
        assert "imei_1" not in d

    def test_catalog_detail_draft_404(self, owner_session):
        # create a DRAFT unit
        base_imei = "35693803564" + str(uuid.uuid4().int)[:3]
        imei = _luhn(base_imei[:14])
        payload = {
            "merek": "Samsung", "model": "A52", "imei_1": imei,
            "harga_beli": 2000000, "harga_jual": 3000000,
            "status_stok": "TERSEDIA", "status_publikasi": "DRAFT",
        }
        r = owner_session.post(f"{BASE_URL}/api/inventory", json=payload)
        assert r.status_code in (200, 201)
        uid = r.json()["id"]
        r2 = requests.get(f"{BASE_URL}/api/catalog/{uid}")
        assert r2.status_code == 404


# ---------- REGISTER ----------
@pytest.fixture(scope="module")
def new_customer():
    email = f"TEST_pel_{uuid.uuid4().hex[:8]}@example.id"
    return {"email": email, "password": "Pelanggan@123"}


class TestRegister:
    def test_register_password_mismatch(self):
        r = requests.post(f"{BASE_URL}/api/auth/register", json={
            "nama": "Mismatch", "email": f"TEST_mm_{uuid.uuid4().hex[:6]}@x.id",
            "telepon": "08123", "password": "aaa123", "konfirmasi_password": "bbb123",
        })
        assert r.status_code == 400

    def test_register_success(self, new_customer):
        r = requests.post(f"{BASE_URL}/api/auth/register", json={
            "nama": "Pelanggan TEST", "email": new_customer["email"],
            "telepon": "081234567890",
            "password": new_customer["password"], "konfirmasi_password": new_customer["password"],
            "setujui_promosi": True, "saluran_promosi": ["whatsapp", "email"],
            "versi_persetujuan": "v1.0",
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["role"] == "pelanggan"
        assert d["email"] == new_customer["email"].lower()
        assert d["promo_consent"]["status"] is True
        assert "whatsapp" in d["promo_consent"]["saluran"]

    def test_register_duplicate_email(self, new_customer):
        r = requests.post(f"{BASE_URL}/api/auth/register", json={
            "nama": "Dup", "email": new_customer["email"],
            "telepon": "08123", "password": "Pelanggan@123", "konfirmasi_password": "Pelanggan@123",
        })
        assert r.status_code == 409


@pytest.fixture(scope="module")
def customer_session(new_customer):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": new_customer["email"], "password": new_customer["password"]})
    assert r.status_code == 200, r.text
    return s


# ---------- ADDRESSES ----------
class TestAddresses:
    def test_initial_empty(self, customer_session):
        r = customer_session.get(f"{BASE_URL}/api/customer/addresses")
        assert r.status_code == 200
        assert r.json() == []

    def test_create_first_is_default(self, customer_session):
        payload = {
            "nama_penerima": "Pel TEST", "telepon_penerima": "081234",
            "provinsi": "Jawa Barat", "kabupaten": "Bandung", "kecamatan": "Coblong",
            "kelurahan": "Dago", "kode_pos": "40135",
            "alamat_lengkap": "Jl TEST No 1", "is_default": False,
        }
        r = customer_session.post(f"{BASE_URL}/api/customer/addresses", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["is_default"] is True, "First address must auto-default"
        assert "id" in d

    def test_update_and_delete(self, customer_session):
        payload = {
            "nama_penerima": "Pel 2", "telepon_penerima": "0812",
            "provinsi": "DKI", "kabupaten": "Jaksel", "kecamatan": "Keb Baru",
            "alamat_lengkap": "Jl Lain",
        }
        r = customer_session.post(f"{BASE_URL}/api/customer/addresses", json=payload)
        aid = r.json()["id"]
        payload["nama_penerima"] = "Pel 2 Edit"
        r2 = customer_session.patch(f"{BASE_URL}/api/customer/addresses/{aid}", json=payload)
        assert r2.status_code == 200
        assert r2.json()["nama_penerima"] == "Pel 2 Edit"
        r3 = customer_session.delete(f"{BASE_URL}/api/customer/addresses/{aid}")
        assert r3.status_code == 200


# ---------- PROMO CONSENT ----------
class TestPromoConsent:
    def test_toggle_off(self, customer_session):
        r = customer_session.patch(f"{BASE_URL}/api/customer/promo-consent", json={"setujui": False})
        assert r.status_code == 200
        d = r.json()["promo_consent"]
        assert d["status"] is False
        assert d.get("revoked_at")

    def test_toggle_on(self, customer_session):
        r = customer_session.patch(f"{BASE_URL}/api/customer/promo-consent", json={
            "setujui": True, "saluran": ["email", "sms"], "versi": "v1.0"
        })
        assert r.status_code == 200
        d = r.json()["promo_consent"]
        assert d["status"] is True
        assert "email" in d["saluran"]
        assert d.get("consented_at")


# ---------- CART ----------
class TestCart:
    def test_cart_initial_empty(self, customer_session):
        r = customer_session.get(f"{BASE_URL}/api/customer")
        assert r.status_code == 200
        d = r.json()
        assert d["items"] == []
        assert d["jumlah_item"] == 0
        assert d["subtotal"] == 0

    def test_add_to_cart(self, customer_session, tayang_unit):
        r = customer_session.post(f"{BASE_URL}/api/customer", json={"unit_id": tayang_unit["id"]})
        assert r.status_code == 200, r.text
        # verify GET
        g = customer_session.get(f"{BASE_URL}/api/customer")
        assert g.status_code == 200
        d = g.json()
        assert d["jumlah_item"] == 1
        assert d["items"][0]["unit_id"] == tayang_unit["id"]
        assert d["items"][0]["merek"] == "Apple"
        assert d["subtotal"] == 9000000

    def test_add_duplicate_idempotent(self, customer_session, tayang_unit):
        r = customer_session.post(f"{BASE_URL}/api/customer", json={"unit_id": tayang_unit["id"]})
        assert r.status_code == 200
        assert "Sudah" in r.json().get("message", "")

    def test_add_draft_rejected(self, customer_session, owner_session):
        # create a DRAFT unit
        base_imei = "35693803564" + str(uuid.uuid4().int)[:3]
        imei = _luhn(base_imei[:14])
        r = owner_session.post(f"{BASE_URL}/api/inventory", json={
            "merek": "Oppo", "model": "Reno", "imei_1": imei,
            "harga_beli": 1000000, "harga_jual": 2000000,
            "status_stok": "TERSEDIA", "status_publikasi": "DRAFT",
        })
        uid = r.json()["id"]
        r2 = customer_session.post(f"{BASE_URL}/api/customer", json={"unit_id": uid})
        assert r2.status_code == 400

    def test_remove_from_cart(self, customer_session, tayang_unit):
        r = customer_session.delete(f"{BASE_URL}/api/customer/{tayang_unit['id']}")
        assert r.status_code == 200
        g = customer_session.get(f"{BASE_URL}/api/customer")
        assert g.json()["jumlah_item"] == 0

    def test_admin_cannot_add(self, owner_session, tayang_unit):
        r = owner_session.post(f"{BASE_URL}/api/customer", json={"unit_id": tayang_unit["id"]})
        assert r.status_code == 403


# ---------- INVENTORY HISTORY ----------
class TestHistoryInventory:
    def test_history_present(self, owner_session, tayang_unit):
        uid = tayang_unit["id"]
        # update harga
        r = owner_session.patch(f"{BASE_URL}/api/inventory/{uid}", json={"harga_jual": 9500000})
        assert r.status_code == 200
        # update stok
        r2 = owner_session.patch(f"{BASE_URL}/api/inventory/{uid}", json={"status_stok": "HOLD", "alasan_hold": "test"})
        assert r2.status_code == 200
        g = owner_session.get(f"{BASE_URL}/api/inventory/{uid}")
        d = g.json()
        assert "history_harga" in d
        assert "history_status" in d
        assert isinstance(d["history_harga"], list)
        assert isinstance(d["history_status"], list)
        assert len(d["history_harga"]) >= 1
        assert len(d["history_status"]) >= 1
