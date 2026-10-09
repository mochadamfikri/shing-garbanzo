"""Phase 3 backend tests: settings publik/admin, checkout, reservasi, upload bukti,
verifikasi admin, pengiriman, role gating."""
import os
import uuid
import time
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


def _new_imei():
    base = "35693803564" + str(uuid.uuid4().int)[:3]
    return _luhn(base[:14])


# --------- Shared fixtures ---------
@pytest.fixture(scope="module")
def owner():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PASS})
    assert r.status_code == 200, r.text
    return s


def _create_tayang_unit(owner_s, harga=5000000):
    payload = {
        "merek": "Apple", "model": "iPhone 12", "varian": "128GB",
        "warna": "Black", "jenis_perangkat": "INTER", "kondisi": "BEKAS",
        "grade_fisik": "A", "kesehatan_baterai": 90,
        "imei_1": _new_imei(),
        "harga_beli": harga - 1000000, "harga_jual": harga,
        "status_stok": "TERSEDIA", "status_publikasi": "DRAFT",
        "foto_urls": ["https://example.com/f.jpg"],
    }
    r = owner_s.post(f"{BASE_URL}/api/inventory", json=payload)
    assert r.status_code in (200, 201), r.text
    uid = r.json()["id"]
    pr = owner_s.patch(f"{BASE_URL}/api/inventory/{uid}", json={"status_publikasi": "TAYANG"})
    assert pr.status_code == 200, pr.text
    return pr.json()


def _register_customer():
    email = f"TEST_p3_{uuid.uuid4().hex[:8]}@example.id"
    pw = "Pelanggan@123"
    r = requests.post(f"{BASE_URL}/api/auth/register", json={
        "nama": "Pel P3", "email": email, "telepon": "08123456789",
        "password": pw, "konfirmasi_password": pw,
    })
    assert r.status_code == 200, r.text
    s = requests.Session()
    lr = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pw})
    assert lr.status_code == 200
    return s, email


def _add_default_address(cs):
    r = cs.post(f"{BASE_URL}/api/customer/addresses", json={
        "nama_penerima": "Pel P3", "telepon_penerima": "08123",
        "provinsi": "DKI", "kabupaten": "Jaksel", "kecamatan": "Keb Baru",
        "kelurahan": "Senayan", "kode_pos": "12190",
        "alamat_lengkap": "Jl TEST No 1", "is_default": True,
    })
    assert r.status_code == 200, r.text
    return r.json()["id"]


# ---------- SETTINGS ----------
class TestSettings:
    def test_public_no_auth(self):
        r = requests.get(f"{BASE_URL}/api/settings/public")
        assert r.status_code == 200
        d = r.json()
        assert "nama_toko" in d
        assert "whatsapp_number" in d
        assert isinstance(d.get("pembayaran_aktif"), list)
        assert isinstance(d.get("pengiriman_aktif"), list)
        kodes_bayar = [m["kode"] for m in d["pembayaran_aktif"]]
        assert "transfer_bank" in kodes_bayar
        for m in d["pembayaran_aktif"]:
            assert m["aktif"] is True
        kodes_kirim = [m["kode"] for m in d["pengiriman_aktif"]]
        assert "ambil_toko" in kodes_kirim
        assert "jne" in kodes_kirim

    def test_admin_full(self, owner):
        r = owner.get(f"{BASE_URL}/api/settings")
        assert r.status_code == 200
        d = r.json()
        assert "pembayaran" in d and "pengiriman" in d
        kodes = [m["kode"] for m in d["pembayaran"]]
        assert {"transfer_bank", "qris_merchant", "kasera_pay"}.issubset(set(kodes))

    def test_patch_toggle_qris(self, owner):
        # ambil current pembayaran
        r = owner.get(f"{BASE_URL}/api/settings")
        pembayaran = r.json()["pembayaran"]
        for m in pembayaran:
            if m["kode"] == "qris_merchant":
                m["aktif"] = True
        p = owner.patch(f"{BASE_URL}/api/settings", json={"pembayaran": pembayaran})
        assert p.status_code == 200, p.text
        # verify public
        pub = requests.get(f"{BASE_URL}/api/settings/public").json()
        kodes = [m["kode"] for m in pub["pembayaran_aktif"]]
        assert "qris_merchant" in kodes
        # revert
        for m in pembayaran:
            if m["kode"] == "qris_merchant":
                m["aktif"] = False
        owner.patch(f"{BASE_URL}/api/settings", json={"pembayaran": pembayaran})

    def test_patch_admin_only(self):
        s, _ = _register_customer()
        r = s.patch(f"{BASE_URL}/api/settings", json={"nama_toko": "X"})
        assert r.status_code == 403


# ---------- CHECKOUT ----------
class TestCheckout:
    def test_checkout_success_ambil_toko(self, owner):
        unit = _create_tayang_unit(owner, harga=5000000)
        cs, email = _register_customer()
        aid = _add_default_address(cs)
        # add to cart
        rc = cs.post(f"{BASE_URL}/api/customer", json={"unit_id": unit["id"]})
        assert rc.status_code == 200, rc.text
        # checkout
        r = cs.post(f"{BASE_URL}/api/orders/checkout", json={
            "address_id": aid,
            "metode_pengiriman_kode": "ambil_toko",
            "metode_pembayaran_kode": "transfer_bank",
        })
        assert r.status_code == 200, r.text
        order = r.json()
        assert order["status_pesanan"] == "MENUNGGU_BAYAR"
        assert order["status_pembayaran"] == "BELUM_BAYAR"
        assert order["nomor_pesanan"].startswith("ORD-")
        assert len(order["items"]) == 1
        assert order["subtotal"] == 5000000
        assert order["biaya_kirim"] == 0
        assert order["total"] == 5000000
        # verifikasi unit HOLD
        gu = owner.get(f"{BASE_URL}/api/inventory/{unit['id']}")
        assert gu.json()["status_stok"] == "HOLD"
        # cart kosong
        gc = cs.get(f"{BASE_URL}/api/customer")
        assert gc.json()["jumlah_item"] == 0

    def test_checkout_empty_cart_400(self, owner):
        cs, _ = _register_customer()
        aid = _add_default_address(cs)
        r = cs.post(f"{BASE_URL}/api/orders/checkout", json={
            "address_id": aid, "metode_pengiriman_kode": "ambil_toko",
            "metode_pembayaran_kode": "transfer_bank",
        })
        assert r.status_code == 400

    def test_checkout_metode_tidak_aktif(self, owner):
        unit = _create_tayang_unit(owner)
        cs, _ = _register_customer()
        aid = _add_default_address(cs)
        cs.post(f"{BASE_URL}/api/customer", json={"unit_id": unit["id"]})
        r = cs.post(f"{BASE_URL}/api/orders/checkout", json={
            "address_id": aid, "metode_pengiriman_kode": "jnt",
            "metode_pembayaran_kode": "transfer_bank",
        })
        assert r.status_code == 400
        # unit tetap TERSEDIA (gagal sebelum reserve kirim-not-active)
        gu = owner.get(f"{BASE_URL}/api/inventory/{unit['id']}")
        assert gu.json()["status_stok"] == "TERSEDIA"

    def test_checkout_admin_forbidden(self, owner):
        unit = _create_tayang_unit(owner)
        # owner tanpa alamat/cart, forward endpoint seharusnya 403
        r = owner.post(f"{BASE_URL}/api/orders/checkout", json={
            "address_id": "x", "metode_pengiriman_kode": "ambil_toko",
            "metode_pembayaran_kode": "transfer_bank",
        })
        assert r.status_code == 403

    def test_reservasi_unit_sudah_hold_tidak_bisa_add_cart(self, owner):
        unit = _create_tayang_unit(owner)
        cs1, _ = _register_customer()
        _add_default_address(cs1)
        cs1.post(f"{BASE_URL}/api/customer", json={"unit_id": unit["id"]})
        cs1.post(f"{BASE_URL}/api/orders/checkout", json={
            "address_id": _add_default_address(cs1), "metode_pengiriman_kode": "ambil_toko",
            "metode_pembayaran_kode": "transfer_bank",
        })
        # pelanggan2 mencoba add unit yang sudah HOLD
        cs2, _ = _register_customer()
        r = cs2.post(f"{BASE_URL}/api/customer", json={"unit_id": unit["id"]})
        # cart check tersedia harus menolak non-TERSEDIA
        assert r.status_code == 400, f"should reject HOLD unit, got {r.status_code}: {r.text}"


# ---------- ORDER LIFECYCLE ----------
class TestOrderLifecycle:
    def test_full_lifecycle(self, owner):
        unit = _create_tayang_unit(owner, harga=6000000)
        cs, email = _register_customer()
        aid = _add_default_address(cs)
        cs.post(f"{BASE_URL}/api/customer", json={"unit_id": unit["id"]})
        co = cs.post(f"{BASE_URL}/api/orders/checkout", json={
            "address_id": aid, "metode_pengiriman_kode": "ambil_toko",
            "metode_pembayaran_kode": "transfer_bank",
        })
        assert co.status_code == 200, co.text
        order_id = co.json()["id"]

        # /mine
        rm = cs.get(f"{BASE_URL}/api/orders/mine")
        assert rm.status_code == 200
        assert any(o["id"] == order_id for o in rm.json())

        # GET detail by owner
        rg = cs.get(f"{BASE_URL}/api/orders/{order_id}")
        assert rg.status_code == 200

        # Pelanggan lain tidak bisa akses
        cs2, _ = _register_customer()
        rno = cs2.get(f"{BASE_URL}/api/orders/{order_id}")
        assert rno.status_code == 404

        # Admin bisa akses
        ra = owner.get(f"{BASE_URL}/api/orders/{order_id}")
        assert ra.status_code == 200

        # Upload bukti bayar
        rb = cs.post(f"{BASE_URL}/api/orders/{order_id}/bukti-bayar",
                     json={"url": "https://example.com/bukti.png"})
        assert rb.status_code == 200, rb.text
        bo = rb.json()
        assert bo["status_pesanan"] == "MENUNGGU_VERIFIKASI"
        assert bo["status_pembayaran"] == "MENUNGGU_VERIFIKASI"
        assert bo["bukti_bayar_url"] == "https://example.com/bukti.png"

        # Admin list filter
        rl = owner.get(f"{BASE_URL}/api/orders", params={"status": "MENUNGGU_VERIFIKASI"})
        assert rl.status_code == 200
        assert any(o["id"] == order_id for o in rl.json())

        # Admin terima
        rv = owner.post(f"{BASE_URL}/api/orders/{order_id}/verifikasi-bayar",
                        json={"diterima": True, "catatan": "ok"})
        assert rv.status_code == 200, rv.text
        v = rv.json()
        assert v["status_pesanan"] == "DIPROSES"
        assert v["status_pembayaran"] == "DITERIMA"
        assert v["status_pengiriman"] == "DIKEMAS"
        # unit TERJUAL
        gu = owner.get(f"{BASE_URL}/api/inventory/{unit['id']}")
        assert gu.json()["status_stok"] == "TERJUAL"

        # Update resi -> DIKIRIM
        rr = owner.patch(f"{BASE_URL}/api/orders/{order_id}/resi", json={
            "nomor_resi": "JNE123456",
            "estimasi_sampai": "3-5 hari",
            "status_pengiriman": "DIKIRIM",
        })
        assert rr.status_code == 200, rr.text
        rd = rr.json()
        assert rd["status_pengiriman"] == "DIKIRIM"
        assert rd["status_pesanan"] == "DIKIRIM"
        assert rd["nomor_resi"] == "JNE123456"

        # DITERIMA -> SELESAI
        rr2 = owner.patch(f"{BASE_URL}/api/orders/{order_id}/resi",
                          json={"status_pengiriman": "DITERIMA"})
        assert rr2.status_code == 200
        assert rr2.json()["status_pesanan"] == "SELESAI"

    def test_tolak_pembayaran_rilis_stok(self, owner):
        unit = _create_tayang_unit(owner, harga=4000000)
        cs, _ = _register_customer()
        aid = _add_default_address(cs)
        cs.post(f"{BASE_URL}/api/customer", json={"unit_id": unit["id"]})
        co = cs.post(f"{BASE_URL}/api/orders/checkout", json={
            "address_id": aid, "metode_pengiriman_kode": "ambil_toko",
            "metode_pembayaran_kode": "transfer_bank",
        })
        oid = co.json()["id"]
        cs.post(f"{BASE_URL}/api/orders/{oid}/bukti-bayar", json={"url": "https://x/p.png"})
        rv = owner.post(f"{BASE_URL}/api/orders/{oid}/verifikasi-bayar",
                        json={"diterima": False, "catatan": "bukti tidak jelas"})
        assert rv.status_code == 200, rv.text
        v = rv.json()
        assert v["status_pesanan"] == "DIBATALKAN"
        assert v["status_pembayaran"] == "DITOLAK"
        gu = owner.get(f"{BASE_URL}/api/inventory/{unit['id']}")
        assert gu.json()["status_stok"] == "TERSEDIA"

    def test_pelanggan_batal(self, owner):
        unit = _create_tayang_unit(owner)
        cs, _ = _register_customer()
        aid = _add_default_address(cs)
        cs.post(f"{BASE_URL}/api/customer", json={"unit_id": unit["id"]})
        co = cs.post(f"{BASE_URL}/api/orders/checkout", json={
            "address_id": aid, "metode_pengiriman_kode": "ambil_toko",
            "metode_pembayaran_kode": "transfer_bank",
        })
        oid = co.json()["id"]
        rb = cs.post(f"{BASE_URL}/api/orders/{oid}/batal")
        assert rb.status_code == 200
        gu = owner.get(f"{BASE_URL}/api/inventory/{unit['id']}")
        assert gu.json()["status_stok"] == "TERSEDIA"


# ---------- ROLE GATING ----------
class TestRoleGating:
    def test_mine_pelanggan_only(self, owner):
        r = owner.get(f"{BASE_URL}/api/orders/mine")
        assert r.status_code == 403

    def test_list_all_requires_staff(self):
        cs, _ = _register_customer()
        r = cs.get(f"{BASE_URL}/api/orders")
        assert r.status_code == 403
