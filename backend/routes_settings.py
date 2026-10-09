"""Endpoint Pengaturan Toko (admin edit + publik baca sebagian)."""
from fastapi import APIRouter, Depends, HTTPException

from auth import require_roles, ROLE_OWNER, ROLE_ADMIN
from models_order import (
    SettingsAdmin, SettingsPublic, SettingsUpdate,
    MetodePembayaranConfig, MetodePengirimanConfig, RekeningBank,
)

router = APIRouter(prefix="/api/settings", tags=["settings"])

SETTINGS_ID = "main"


DEFAULT_SETTINGS = SettingsAdmin(
    nama_toko="Toko HP",
    whatsapp_number="628123456789",
    whatsapp_pesan_default="Halo, saya ingin bertanya tentang produk di Toko HP.",
    alamat_toko="",
    email_toko="",
    logo_url="",
    pembayaran=[
        MetodePembayaranConfig(
            kode="transfer_bank", nama="Transfer Bank Manual", aktif=True, prioritas=1,
            deskripsi="Transfer manual ke rekening toko, lalu upload bukti bayar.",
            petunjuk="Transfer sesuai jumlah persis. Upload bukti transfer pada halaman pesanan untuk diverifikasi admin.",
            rekening=[RekeningBank(bank="BCA", nomor="1234567890", atas_nama="Toko HP")],
            siap_integrasi=True,
        ),
        MetodePembayaranConfig(
            kode="qris_merchant", nama="QRIS Merchant", aktif=False, prioritas=2,
            deskripsi="Scan QRIS merchant toko.",
            petunjuk="Scan QR code di bawah menggunakan aplikasi e-wallet/bank Anda, lalu upload bukti.",
            qr_image_url="", siap_integrasi=False,
        ),
        MetodePembayaranConfig(
            kode="kasera_pay", nama="Kasera Pay", aktif=False, prioritas=3,
            deskripsi="Integrasi Kasera Pay (akan tersedia setelah kredensial production).",
            siap_integrasi=False,
        ),
    ],
    pengiriman=[
        MetodePengirimanConfig(kode="ambil_toko", nama="Ambil di Toko", aktif=True, prioritas=1, default_biaya=0, deskripsi="Ambil langsung di alamat toko."),
        MetodePengirimanConfig(kode="jne", nama="JNE REG", aktif=True, prioritas=2, default_biaya=25000, butuh_konfirmasi=True),
        MetodePengirimanConfig(kode="jnt", nama="J&T Express", aktif=False, prioritas=3, default_biaya=24000, butuh_konfirmasi=True),
        MetodePengirimanConfig(kode="sicepat", nama="SiCepat", aktif=False, prioritas=4, default_biaya=23000, butuh_konfirmasi=True),
        MetodePengirimanConfig(kode="gosend", nama="GoSend (Instant)", aktif=False, prioritas=5, default_biaya=0, butuh_konfirmasi=True, deskripsi="Driver instant Gojek, ongkir dikonfirmasi admin."),
        MetodePengirimanConfig(kode="grab", nama="GrabExpress", aktif=False, prioritas=6, default_biaya=0, butuh_konfirmasi=True),
    ],
)


async def _load() -> dict:
    from server import db
    doc = await db.settings.find_one({"id": SETTINGS_ID})
    if not doc:
        data = DEFAULT_SETTINGS.model_dump()
        data["id"] = SETTINGS_ID
        await db.settings.insert_one(data)
        doc = data
    doc.pop("_id", None)
    return doc


@router.get("/public", response_model=SettingsPublic)
async def public_settings():
    doc = await _load()
    doc["pembayaran_aktif"] = [m for m in doc.get("pembayaran", []) if m.get("aktif")]
    doc["pengiriman_aktif"] = [m for m in doc.get("pengiriman", []) if m.get("aktif")]
    return SettingsPublic(**doc)


@router.get("", response_model=SettingsAdmin)
async def admin_settings(_user=Depends(require_roles(ROLE_OWNER, ROLE_ADMIN))):
    doc = await _load()
    return SettingsAdmin(**doc)


@router.patch("", response_model=SettingsAdmin)
async def update_settings(payload: SettingsUpdate, _user=Depends(require_roles(ROLE_OWNER, ROLE_ADMIN))):
    from server import db
    await _load()  # ensure exists
    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="Tidak ada perubahan")
    await db.settings.update_one({"id": SETTINGS_ID}, {"$set": update_data})
    doc = await db.settings.find_one({"id": SETTINGS_ID})
    doc.pop("_id", None)
    return SettingsAdmin(**doc)


async def get_settings_internal():
    """Helper untuk routes_orders."""
    return await _load()
