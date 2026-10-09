"""Pengiriman email transaksional via SMTP (Hostinger/Gmail).
Tidak butuh API key - pakai kredensial mailbox. Lewati otomatis bila belum dikonfigurasi."""
import logging
import os
import smtplib
import ssl
from email.message import EmailMessage
from html import escape

from starlette.concurrency import run_in_threadpool

logger = logging.getLogger(__name__)


def is_configured() -> bool:
    return all(os.environ.get(k) for k in ("SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD", "EMAIL_FROM"))


def _config():
    host = os.environ.get("SMTP_HOST", "").strip()
    user = os.environ.get("SMTP_USER", "").strip()
    password = os.environ.get("SMTP_PASSWORD", "")
    sender = os.environ.get("EMAIL_FROM", "").strip()
    try:
        port = int(os.environ.get("SMTP_PORT", "465"))
    except ValueError:
        port = 465
    if not all((host, user, password, sender)):
        return None
    return host, port, user, password, sender


def _rupiah(n) -> str:
    try:
        return "Rp " + f"{int(round(float(n))):,}".replace(",", ".")
    except Exception:
        return f"Rp {n}"


def _receipt_html(nama, nomor_pesanan, total, items, paid_at) -> str:
    rows = ""
    for it in items or []:
        bagian = " ".join(str(it.get(k, "")) for k in ("merek", "model", "varian") if it.get(k))
        harga = it.get("harga_jual") or it.get("harga") or 0
        rows += (
            f'<tr><td style="padding:8px 0;border-top:1px solid #eef">{escape(bagian or "Produk")}</td>'
            f'<td style="padding:8px 0;border-top:1px solid #eef;text-align:right">{escape(_rupiah(harga))}</td></tr>'
        )
    return f"""<!doctype html>
<html><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
  <div style="max-width:600px;margin:28px auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0">
    <div style="background:#4f46e5;padding:22px 28px;color:#fff">
      <h1 style="margin:0;font-size:20px">Struk Pembayaran</h1>
      <p style="margin:6px 0 0;opacity:.9;font-size:13px">Toko HP</p>
    </div>
    <div style="padding:28px">
      <p style="margin:0 0 6px">Halo {escape(str(nama))},</p>
      <p style="margin:0 0 18px;color:#475569">Pembayaran QRIS Anda telah kami terima. Pesanan sedang kami proses. Terima kasih!</p>
      <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:6px 0;color:#64748b">No. Pesanan</td>
            <td style="padding:6px 0;text-align:right"><strong>{escape(str(nomor_pesanan))}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Waktu Bayar</td>
            <td style="padding:6px 0;text-align:right">{escape(str(paid_at))}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Metode</td>
            <td style="padding:6px 0;text-align:right">QRIS (Kasera)</td></tr>
      </table>
      <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;margin-top:14px">
        {rows}
        <tr><td style="padding:12px 0;border-top:2px solid #0f172a;font-weight:bold">Total Dibayar</td>
            <td style="padding:12px 0;border-top:2px solid #0f172a;text-align:right;font-weight:bold;color:#4f46e5">{escape(_rupiah(total))}</td></tr>
      </table>
      <p style="margin:22px 0 0;color:#94a3b8;font-size:12px">Simpan email ini sebagai bukti pembayaran Anda.</p>
    </div>
  </div>
</body></html>"""


def _send_sync(to_email, nama, nomor_pesanan, total, items, paid_at) -> bool:
    cfg = _config()
    if cfg is None:
        logger.info("SMTP belum dikonfigurasi; lewati struk untuk %s", nomor_pesanan)
        return False
    host, port, user, password, sender = cfg
    msg = EmailMessage()
    msg["Subject"] = f"Struk Pembayaran - Pesanan {nomor_pesanan}"
    msg["From"] = sender
    msg["To"] = to_email
    msg.set_content(f"Pembayaran pesanan {nomor_pesanan} sebesar {_rupiah(total)} telah diterima. Terima kasih.")
    msg.add_alternative(_receipt_html(nama, nomor_pesanan, total, items, paid_at), subtype="html")
    context = ssl.create_default_context()
    if port == 465:
        with smtplib.SMTP_SSL(host, port, context=context, timeout=20) as s:
            s.login(user, password)
            s.send_message(msg)
    else:
        with smtplib.SMTP(host, port, timeout=20) as s:
            s.ehlo()
            s.starttls(context=context)
            s.ehlo()
            s.login(user, password)
            s.send_message(msg)
    logger.info("Struk pembayaran terkirim untuk %s", nomor_pesanan)
    return True


async def send_receipt_qris(*, to_email, nama, nomor_pesanan, total, items, paid_at) -> bool:
    return await run_in_threadpool(
        _send_sync, to_email, nama, nomor_pesanan, total, items, paid_at
    )
