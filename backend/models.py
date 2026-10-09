"""Pydantic schemas untuk request/response. Dokumen Mongo disimpan dengan field 'id' (uuid)."""
from datetime import datetime
from typing import List, Optional, Any
from pydantic import BaseModel, EmailStr, Field, ConfigDict

# ---------- USER ----------
class UserPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: EmailStr
    nama: str
    role: str
    aktif: bool = True
    telepon: Optional[str] = ""
    promo_consent: Optional[dict] = None
    created_at: datetime


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    nama: str
    email: EmailStr
    telepon: str
    password: str
    konfirmasi_password: str
    setujui_promosi: bool = False
    saluran_promosi: List[str] = Field(default_factory=list)  # ["whatsapp", "email", "sms"]
    versi_persetujuan: str = "v1.0"


# ---------- INVENTORY ----------
JENIS_PERANGKAT = {"INTER", "RESMI"}
KONDISI = {"BARU", "BEKAS", "REFURBISHED"}
STATUS_STOK = {"TERSEDIA", "HOLD", "TERJUAL", "SERVIS", "DIARSIPKAN"}
STATUS_PUBLIKASI = {"DRAFT", "TAYANG", "DISEMBUNYIKAN", "DIARSIPKAN"}


class UnitHPCreate(BaseModel):
    merek: str
    model: str
    varian: Optional[str] = ""
    ram: Optional[str] = ""
    penyimpanan: Optional[str] = ""
    warna: Optional[str] = ""
    jenis_perangkat: str = "INTER"
    kondisi: str = "BARU"
    grade_fisik: Optional[str] = ""
    kesehatan_baterai: Optional[int] = None
    imei_1: str
    imei_2: Optional[str] = ""
    serial_number: Optional[str] = ""
    kelengkapan: Optional[str] = ""
    catatan_pemeriksaan: Optional[str] = ""
    garansi: Optional[str] = ""
    supplier: Optional[str] = ""
    harga_beli: float = 0
    biaya_reparasi: float = 0
    biaya_tambahan: float = 0
    harga_jual: float = 0
    deskripsi: Optional[str] = ""
    foto_urls: List[str] = Field(default_factory=list)
    video_urls: List[str] = Field(default_factory=list)
    status_stok: str = "TERSEDIA"
    status_publikasi: str = "DRAFT"
    produk_unggulan: bool = False


class UnitHPUpdate(BaseModel):
    merek: Optional[str] = None
    model: Optional[str] = None
    varian: Optional[str] = None
    ram: Optional[str] = None
    penyimpanan: Optional[str] = None
    warna: Optional[str] = None
    jenis_perangkat: Optional[str] = None
    kondisi: Optional[str] = None
    grade_fisik: Optional[str] = None
    kesehatan_baterai: Optional[int] = None
    imei_1: Optional[str] = None
    imei_2: Optional[str] = None
    serial_number: Optional[str] = None
    kelengkapan: Optional[str] = None
    catatan_pemeriksaan: Optional[str] = None
    garansi: Optional[str] = None
    supplier: Optional[str] = None
    harga_beli: Optional[float] = None
    biaya_reparasi: Optional[float] = None
    biaya_tambahan: Optional[float] = None
    harga_jual: Optional[float] = None
    deskripsi: Optional[str] = None
    foto_urls: Optional[List[str]] = None
    video_urls: Optional[List[str]] = None
    status_stok: Optional[str] = None
    status_publikasi: Optional[str] = None
    produk_unggulan: Optional[bool] = None
    alasan_hold: Optional[str] = None


class UnitHPPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    merek: str
    model: str
    varian: Optional[str] = ""
    ram: Optional[str] = ""
    penyimpanan: Optional[str] = ""
    warna: Optional[str] = ""
    jenis_perangkat: str
    kondisi: str
    grade_fisik: Optional[str] = ""
    kesehatan_baterai: Optional[int] = None
    imei_1: str
    imei_2: Optional[str] = ""
    serial_number: Optional[str] = ""
    kelengkapan: Optional[str] = ""
    catatan_pemeriksaan: Optional[str] = ""
    garansi: Optional[str] = ""
    supplier: Optional[str] = ""
    harga_beli: float = 0
    biaya_reparasi: float = 0
    biaya_tambahan: float = 0
    harga_jual: float = 0
    total_modal: float = 0
    estimasi_laba_kotor: float = 0
    deskripsi: Optional[str] = ""
    foto_urls: List[str] = Field(default_factory=list)
    video_urls: List[str] = Field(default_factory=list)
    status_stok: str
    status_publikasi: str
    produk_unggulan: bool = False
    tanggal_input: datetime
    tanggal_input_fmt: str = ""
    alasan_hold: Optional[str] = ""
    hold_oleh: Optional[str] = ""
    hold_batas: Optional[datetime] = None
    dibuat_oleh: Optional[str] = ""
    history_harga: List[Any] = Field(default_factory=list)
    history_status: List[Any] = Field(default_factory=list)


# ---------- CATALOG (publik) ----------
class CatalogItemPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    merek: str
    model: str
    varian: Optional[str] = ""
    ram: Optional[str] = ""
    penyimpanan: Optional[str] = ""
    warna: Optional[str] = ""
    jenis_perangkat: str
    kondisi: str
    grade_fisik: Optional[str] = ""
    kesehatan_baterai: Optional[int] = None
    kelengkapan: Optional[str] = ""
    garansi: Optional[str] = ""
    harga_jual: float
    foto_urls: List[str] = Field(default_factory=list)
    video_urls: List[str] = Field(default_factory=list)
    deskripsi: Optional[str] = ""
    tersedia: bool = True
    produk_unggulan: bool = False


# ---------- ADDRESS ----------
class AddressBase(BaseModel):
    nama_penerima: str
    telepon_penerima: str
    provinsi: str
    kabupaten: str
    kecamatan: str
    kelurahan: Optional[str] = ""
    kode_pos: Optional[str] = ""
    alamat_lengkap: str
    nomor_rumah: Optional[str] = ""
    patokan: Optional[str] = ""
    pin_lokasi: Optional[str] = ""
    is_default: bool = False


class AddressCreate(AddressBase):
    pass


class AddressPublic(AddressBase):
    model_config = ConfigDict(extra="ignore")
    id: str


# ---------- PROMO CONSENT ----------
class PromoConsentUpdate(BaseModel):
    setujui: bool
    saluran: List[str] = Field(default_factory=list)
    versi: str = "v1.0"


# ---------- CART ----------
class CartAddRequest(BaseModel):
    unit_id: str


class CartItemPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")
    unit_id: str
    added_at: datetime
    # snapshot info
    merek: str
    model: str
    varian: Optional[str] = ""
    warna: Optional[str] = ""
    harga_jual: float
    foto_utama: Optional[str] = None
    tersedia: bool = True


class CartPublic(BaseModel):
    items: List[CartItemPublic]
    jumlah_item: int
    subtotal: float
