"""Utility helpers: Luhn validation, date formatting Bahasa Indonesia, uang/money."""
from datetime import datetime, timezone
from decimal import Decimal

BULAN_ID = [
    "JANUARI", "FEBRUARI", "MARET", "APRIL", "MEI", "JUNI",
    "JULI", "AGUSTUS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER",
]


def format_tanggal_id(dt: datetime) -> str:
    """Format tanggal ke format: 09/OKTOBER/2026"""
    return f"{dt.day:02d}/{BULAN_ID[dt.month - 1]}/{dt.year}"


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def luhn_check(number: str) -> bool:
    """Validasi Luhn untuk IMEI 15 digit standar."""
    if not number or not number.isdigit():
        return False
    digits = [int(c) for c in number]
    checksum = 0
    for i, d in enumerate(reversed(digits)):
        if i % 2 == 1:
            d *= 2
            if d > 9:
                d -= 9
        checksum += d
    return checksum % 10 == 0


def validate_imei(imei: str) -> tuple[bool, str]:
    """Return (ok, pesan). Terima 14-17 digit numerik.
    Jika 15 digit (IMEI standar), harus lulus Luhn."""
    if not imei:
        return False, "IMEI tidak boleh kosong"
    imei = imei.strip()
    if not imei.isdigit():
        return False, "IMEI hanya boleh berisi angka"
    if not (14 <= len(imei) <= 17):
        return False, f"Panjang IMEI harus 14-17 digit (saat ini {len(imei)})"
    if len(imei) == 15 and not luhn_check(imei):
        return False, "Checksum IMEI (Luhn) tidak valid"
    return True, "OK"


def to_decimal(value) -> Decimal:
    """Konversi ke Decimal secara aman (hindari float)."""
    if value is None or value == "":
        return Decimal("0")
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def format_rupiah(value) -> str:
    """Format angka menjadi 'Rp 1.500.000'."""
    try:
        n = int(to_decimal(value))
    except Exception:
        n = 0
    s = f"{n:,}".replace(",", ".")
    return f"Rp {s}"
