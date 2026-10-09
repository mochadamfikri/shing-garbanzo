"""Model-model Pydantic untuk Fase 3 (settings, pesanan, pembayaran, pengiriman)."""
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict

# ---------- SETTINGS ----------
class RekeningBank(BaseModel):
    bank: str
    nomor: str
    atas_nama: str


class MetodePembayaranConfig(BaseModel):
    kode: str                  # "transfer_bank" | "qris_merchant" | "kasera_pay"
    nama: str
    aktif: bool = False
    prioritas: int = 1
    deskripsi: str = ""
    petunjuk: str = ""
    rekening: List[RekeningBank] = Field(default_factory=list)
    qr_image_url: str = ""
    siap_integrasi: bool = False  # True hanya kalau kredensial siap


class TarifOngkir(BaseModel):
    wilayah: str
    biaya: float


class MetodePengirimanConfig(BaseModel):
    kode: str      # "jne" | "jnt" | "sicepat" | "gosend" | "grab" | "ambil_toko" | "custom"
    nama: str
    aktif: bool = False
    prioritas: int = 1
    deskripsi: str = ""
    default_biaya: float = 0
    tabel_ongkir: List[TarifOngkir] = Field(default_factory=list)
    butuh_konfirmasi: bool = False  # true artinya "ongkir dikonfirmasi admin"


class SettingsPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")
    nama_toko: str = "Toko HP"
    whatsapp_number: str = ""
    whatsapp_pesan_default: str = "Halo, saya ingin bertanya tentang produk."
    alamat_toko: str = ""
    email_toko: str = ""
    logo_url: str = ""
    pembayaran_aktif: List[MetodePembayaranConfig] = Field(default_factory=list)
    pengiriman_aktif: List[MetodePengirimanConfig] = Field(default_factory=list)


class SettingsAdmin(BaseModel):
    model_config = ConfigDict(extra="ignore")
    nama_toko: str = "Toko HP"
    whatsapp_number: str = ""
    whatsapp_pesan_default: str = "Halo, saya ingin bertanya tentang produk."
    alamat_toko: str = ""
    email_toko: str = ""
    logo_url: str = ""
    pembayaran: List[MetodePembayaranConfig] = Field(default_factory=list)
    pengiriman: List[MetodePengirimanConfig] = Field(default_factory=list)


class SettingsUpdate(BaseModel):
    nama_toko: Optional[str] = None
    whatsapp_number: Optional[str] = None
    whatsapp_pesan_default: Optional[str] = None
    alamat_toko: Optional[str] = None
    email_toko: Optional[str] = None
    logo_url: Optional[str] = None
    pembayaran: Optional[List[MetodePembayaranConfig]] = None
    pengiriman: Optional[List[MetodePengirimanConfig]] = None


# ---------- ORDERS ----------
class CheckoutRequest(BaseModel):
    address_id: str
    metode_pengiriman_kode: str
    metode_pembayaran_kode: str
    catatan_pelanggan: Optional[str] = ""


class OrderItemSnapshot(BaseModel):
    unit_id: str
    merek: str
    model: str
    varian: Optional[str] = ""
    warna: Optional[str] = ""
    harga_jual: float
    modal: float = 0  # snapshot total_modal (harga_beli+biaya_reparasi+biaya_tambahan) saat checkout
    foto_utama: Optional[str] = None


class OrderAddressSnapshot(BaseModel):
    nama_penerima: str
    telepon_penerima: str
    alamat_lengkap: str
    kelurahan: Optional[str] = ""
    kecamatan: str
    kabupaten: str
    provinsi: str
    kode_pos: Optional[str] = ""
    patokan: Optional[str] = ""


class OrderMetode(BaseModel):
    kode: str
    nama: str


class OrderPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    nomor_pesanan: str
    user_id: str
    nama_pelanggan: str
    email: str
    telepon: str
    alamat_snapshot: OrderAddressSnapshot
    items: List[OrderItemSnapshot]
    subtotal: float
    biaya_kirim: float
    total: float
    metode_pengiriman: OrderMetode
    metode_pembayaran: OrderMetode
    status_pesanan: str
    status_pembayaran: str
    status_pengiriman: str
    bukti_bayar_url: Optional[str] = None
    bukti_bayar_at: Optional[datetime] = None
    nomor_resi: Optional[str] = ""
    tanggal_kirim: Optional[datetime] = None
    estimasi_sampai: Optional[str] = ""
    catatan_pelanggan: Optional[str] = ""
    catatan_admin: Optional[str] = ""
    created_at: datetime
    created_at_fmt: str = ""


class UploadBuktiBayarRequest(BaseModel):
    url: str


class VerifikasiBayarRequest(BaseModel):
    diterima: bool
    catatan: Optional[str] = ""


class UpdateResiRequest(BaseModel):
    nomor_resi: Optional[str] = None
    tanggal_kirim: Optional[datetime] = None
    estimasi_sampai: Optional[str] = None
    status_pengiriman: Optional[str] = None  # "MENUNGGU", "DIKEMAS", "DIKIRIM", "DITERIMA"
    catatan_admin: Optional[str] = None


# Status constants
STATUS_PESANAN = {"MENUNGGU_BAYAR", "MENUNGGU_VERIFIKASI", "DIPROSES", "DIKIRIM", "SELESAI", "DIBATALKAN", "KEDALUWARSA"}
STATUS_PEMBAYARAN = {"BELUM_BAYAR", "MENUNGGU_VERIFIKASI", "DITERIMA", "DITOLAK"}
STATUS_PENGIRIMAN = {"MENUNGGU", "DIKEMAS", "DIKIRIM", "DITERIMA"}
