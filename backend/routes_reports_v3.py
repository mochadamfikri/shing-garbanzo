"""Endpoints for Daily, Weekly, Monthly Reports and genuine 2-Sheet .xlsx Excel Export."""
import io
import zoneinfo
from datetime import datetime, timezone, timedelta
from typing import Literal
from fastapi import APIRouter, Depends, Query, Response, HTTPException
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

from auth import require_roles, ROLE_OWNER, ROLE_ADMIN
from utils import now_utc, format_tanggal_id, format_rupiah

router = APIRouter(prefix="/api/reports-v3", tags=["reports-v3"])

PeriodType = Literal["daily", "weekly", "monthly"]
WIB = zoneinfo.ZoneInfo("Asia/Jakarta")


def get_period_bounds(period: PeriodType) -> tuple[datetime, datetime, str]:
    now_wib = datetime.now(WIB)
    end_wib = now_wib.replace(hour=23, minute=59, second=59, microsecond=999999)
    if period == "daily":
        start_wib = now_wib.replace(hour=0, minute=0, second=0, microsecond=0)
        label = f"Harian ({start_wib.strftime('%d %b %Y')})"
    elif period == "weekly":
        start_wib = (now_wib - timedelta(days=6)).replace(hour=0, minute=0, second=0, microsecond=0)
        label = f"Mingguan ({start_wib.strftime('%d %b')} - {end_wib.strftime('%d %b %Y')})"
    elif period == "monthly":
        start_wib = now_wib.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        label = f"Bulanan ({start_wib.strftime('%B %Y')})"

    # Convert to UTC for MongoDB queries
    start_utc = start_wib.astimezone(timezone.utc)
    end_utc = end_wib.astimezone(timezone.utc)
    return start_utc, end_utc, label


async def fetch_report_data(db, start: datetime, end: datetime):
    # Fetch POS sales in range
    q_sales = {
        "status": "SELESAI",
        "tanggal_jual": {"$gte": start.isoformat(), "$lte": end.isoformat()}
    }
    sales = await db.pos_sales.find(q_sales).sort("tanggal_jual", -1).to_list(5000)

    # Fetch Expenses in range
    q_exp = {
        "tanggal": {"$gte": start.strftime("%Y-%m-%d"), "$lte": end.strftime("%Y-%m-%d")}
    }
    expenses = await db.expenses.find(q_exp).to_list(1000)

    total_omzet = sum(float(s.get("penjualan_bersih") or 0) for s in sales)
    total_hpp = sum(float(s.get("hpp") or 0) for s in sales)
    total_reparasi = 0.0
    total_operasional_unit = 0.0
    total_pengeluaran_toko = sum(float(e.get("nominal") or 0) for e in expenses)

    sold_units = []
    for s in sales:
        tgl_str = s.get("tanggal_jual", "")
        try:
            tgl_dt = datetime.fromisoformat(tgl_str).astimezone(WIB)
            tgl_fmt = tgl_dt.strftime("%d/%m/%Y %H:%M WIB")
        except Exception:
            tgl_fmt = tgl_str

        for item in s.get("items", []):
            rep = float(item.get("biaya_reparasi") or 0)
            op = float(item.get("biaya_operasional") or 0)
            total_reparasi += rep
            total_operasional_unit += op

            sold_units.append({
                "tanggal": tgl_fmt,
                "nomor_transaksi": str(s.get("nomor_transaksi") or "-"),
                "kasir": str(s.get("kasir") or "-"),
                "metode": str(s.get("metode_pembayaran") or "TUNAI"),
                "merek": str(item.get("merek") or "-"),
                "model": str(item.get("model") or "-"),
                "varian": str(item.get("varian") or "-"),
                "penyimpanan": str(item.get("penyimpanan") or "-"),
                "warna": str(item.get("warna") or "-"),
                "kondisi": str(item.get("kondisi") or "BEKAS"),
                "part_number": str(item.get("part_number") or "-"),
                "model_number": str(item.get("model_number") or "-"),
                "eid": str(item.get("eid") or "-"),
                "serial_number": str(item.get("serial_number") or "-"),
                "imei_1": str(item.get("imei_1") or item.get("imei_masked") or "-"),
                "imei_2": str(item.get("imei_2") or "-"),
                "jalur_distributor": str(item.get("jalur_distributor") or "Inter"),
                "status_sinyal": str(item.get("status_sinyal") or "Sinyal Aman"),
                "kelengkapan": str(item.get("kelengkapan") or "Fullset"),
                "addons": ", ".join(item.get("addons") or []) if item.get("addons") else "-",
                "harga_beli": float(item.get("harga_beli") or 0),
                "biaya_reparasi": rep,
                "biaya_operasional": op,
                "total_modal": float(item.get("modal") or (float(item.get("harga_beli") or 0) + rep + op)),
                "harga_jual": float(item.get("harga_jual") or item.get("harga_akhir") or 0),
                "diskon": float(item.get("diskon") or 0),
                "penjualan_bersih": float(item.get("harga_akhir") or item.get("harga_jual") or 0),
                "laba_kotor": float(item.get("harga_akhir") or item.get("harga_jual") or 0) - float(item.get("modal") or 0),
                "catatan": str(s.get("catatan") or "-"),
            })

    total_laba_kotor = total_omzet - total_hpp
    total_biaya_operasional_semua = total_operasional_unit + total_pengeluaran_toko
    laba_bersih = total_laba_kotor - total_pengeluaran_toko
    margin_persen = (laba_bersih / total_omzet * 100) if total_omzet > 0 else 0.0

    return {
        "sales": sales,
        "expenses": expenses,
        "sold_units": sold_units,
        "summary": {
            "total_transaksi": len(sales),
            "total_unit_terjual": len(sold_units),
            "total_omzet": total_omzet,
            "total_hpp": total_hpp,
            "total_reparasi": total_reparasi,
            "total_operasional": total_biaya_operasional_semua,
            "total_laba_kotor": total_laba_kotor,
            "total_pengeluaran_toko": total_pengeluaran_toko,
            "laba_bersih": laba_bersih,
            "margin_persen": round(margin_persen, 2)
        }
    }


@router.get("/period")
async def get_period_report(
    period: PeriodType = Query("daily"),
    _user=Depends(require_roles(ROLE_OWNER, ROLE_ADMIN)),
):
    from server import db
    start, end, label = get_period_bounds(period)
    data = await fetch_report_data(db, start, end)
    return {
        "period": period,
        "period_label": label,
        "start": start.isoformat(),
        "end": end.isoformat(),
        "summary": data["summary"],
        "sold_units": data["sold_units"][:100],
        "sales": [
            {
                "id": s.get("id"),
                "nomor_transaksi": s.get("nomor_transaksi"),
                "penjualan_bersih": s.get("penjualan_bersih"),
                "metode_pembayaran": s.get("metode_pembayaran"),
                "tanggal_jual": s.get("tanggal_jual"),
                "items_count": len(s.get("items", []))
            }
            for s in data["sales"][:50]
        ]
    }


@router.get("/export-excel")
async def export_excel(
    period: PeriodType = Query("daily"),
    _user=Depends(require_roles(ROLE_OWNER, ROLE_ADMIN)),
):
    """Generate EXACT 2-SHEET professional Excel Workbook (.xlsx) with strict text formatting for IDs."""
    from server import db
    start, end, label = get_period_bounds(period)
    data = await fetch_report_data(db, start, end)

    wb = Workbook()

    # Styling definitions
    font_title = Font(name="Calibri", size=14, bold=True, color="1E3A8A")
    font_header = Font(name="Calibri", size=10, bold=True, color="FFFFFF")
    fill_header = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
    font_bold = Font(name="Calibri", size=10, bold=True)
    font_regular = Font(name="Calibri", size=10)
    fill_alt = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")

    border_thin = Border(
        left=Side(style='thin', color='CBD5E1'),
        right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'),
        bottom=Side(style='thin', color='CBD5E1')
    )

    # ==========================================
    # SHEET 1: Summary (Rekapitulasi Keuangan)
    # ==========================================
    ws_summary = wb.active
    ws_summary.title = "Summary"

    ws_summary.append(["SADAM GADGET — LAPORAN REKAP KEUANGAN & PENJUALAN"])
    ws_summary.cell(row=1, column=1).font = font_title
    ws_summary.append([f"Periode: {label} (Timezone: Asia/Jakarta)"])
    ws_summary.append([f"Tanggal Cetak: {datetime.now(WIB).strftime('%d/%m/%Y %H:%M:%S WIB')}"])
    ws_summary.append([])

    headers_summary = ["Metrik Indikator", "Nilai (Rp / Qty)", "Keterangan"]
    ws_summary.append(headers_summary)
    for col in range(1, 4):
        c = ws_summary.cell(row=5, column=col)
        c.font = font_header
        c.fill = fill_header
        c.alignment = Alignment(horizontal="center", vertical="center")

    s = data["summary"]
    metrics = [
        ("Total Transaksi Penjualan", s["total_transaksi"], "Jumlah transaksi kasir selesai"),
        ("Total Unit HP Terjual", s["total_unit_terjual"], "Fisik unit HP berpindah tangan"),
        ("Total Omzet Penjualan", s["total_omzet"], "Gross sales kotor diterima kasir"),
        ("Total Beban Pokok (HPP/Modal)", s["total_hpp"], "Total modal awal unit terjual"),
        ("Biaya Reparasi Unit", s["total_reparasi"], "Biaya perbaikan/teknisi pada unit terjual"),
        ("Biaya Operasional (Unit + Toko)", s["total_operasional"], "Ongkos COD, bensin, dan beban operasional"),
        ("Laba Kotor (Gross Profit)", s["total_laba_kotor"], "Omzet dikurangi HPP unit"),
        ("Laba Bersih (Net Profit)", s["laba_bersih"], "Laba riil setelah semua beban operasional"),
        ("Margin Keuntungan Bersih", f"{s['margin_persen']}%", "Persentase laba bersih terhadap omzet"),
    ]

    for row_idx, (m, v, desc) in enumerate(metrics, start=6):
        ws_summary.append([m, v, desc])
        ws_summary.cell(row=row_idx, column=1).font = font_bold
        ws_summary.cell(row=row_idx, column=1).border = border_thin
        
        c2 = ws_summary.cell(row=row_idx, column=2)
        c2.font = font_bold if "Laba" in m or "Omzet" in m else font_regular
        c2.border = border_thin
        if isinstance(v, (int, float)) and "Total Transaksi" not in m and "Total Unit" not in m:
            c2.number_format = '#,##0'
            c2.alignment = Alignment(horizontal="right")
        else:
            c2.alignment = Alignment(horizontal="center")

        c3 = ws_summary.cell(row=row_idx, column=3)
        c3.font = font_regular
        c3.border = border_thin

    ws_summary.column_dimensions['A'].width = 34
    ws_summary.column_dimensions['B'].width = 24
    ws_summary.column_dimensions['C'].width = 44

    # ==========================================
    # SHEET 2: Data Penjualan (Rincian per Unit)
    # ==========================================
    ws_data = wb.create_sheet(title="Data Penjualan")

    headers_data = [
        "Waktu Transaksi (WIB)", "No. Transaksi", "Kasir", "Metode Bayar",
        "Merek", "Model", "Varian", "Storage", "Warna", "Kondisi",
        "Part Number", "Model Number", "EID", "Serial Number",
        "IMEI 1", "IMEI 2", "Jalur Distributor", "Status Sinyal",
        "Kelengkapan", "Add-ons",
        "Harga Beli (Modal)", "Biaya Reparasi", "Biaya Operasional", "Total HPP",
        "Harga Jual", "Diskon", "Penjualan Bersih", "Laba Transaksi", "Catatan"
    ]
    ws_data.append(headers_data)
    for col_idx in range(1, len(headers_data) + 1):
        c = ws_data.cell(row=1, column=col_idx)
        c.font = font_header
        c.fill = fill_header
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

    ws_data.row_dimensions[1].height = 28

    # Add each sold unit
    for row_idx, u in enumerate(data["sold_units"], start=2):
        row_vals = [
            u["tanggal"],
            u["nomor_transaksi"],
            u["kasir"],
            u["metode"],
            u["merek"],
            u["model"],
            u["varian"],
            u["penyimpanan"],
            u["warna"],
            u["kondisi"],
            u["part_number"],
            u["model_number"],
            u["eid"],
            u["serial_number"],
            u["imei_1"],
            u["imei_2"],
            u["jalur_distributor"],
            u["status_sinyal"],
            u["kelengkapan"],
            u["addons"],
            u["harga_beli"],
            u["biaya_reparasi"],
            u["biaya_operasional"],
            u["total_modal"],
            u["harga_jual"],
            u["diskon"],
            u["penjualan_bersih"],
            u["laba_kotor"],
            u["catatan"]
        ]
        ws_data.append(row_vals)

        # Style cells
        fill = fill_alt if row_idx % 2 == 0 else PatternFill(fill_type=None)
        for col_idx in range(1, len(row_vals) + 1):
            cell = ws_data.cell(row=row_idx, column=col_idx)
            cell.font = font_regular
            cell.border = border_thin
            if fill.fill_type:
                cell.fill = fill

            # CRITICAL: Force IMEI, EID, Serial, Part Number as TEXT so Excel doesn't display scientific notation
            if col_idx in (11, 12, 13, 14, 15, 16):
                cell.number_format = '@'  # Explicit TEXT format
                cell.alignment = Alignment(horizontal="left")
            elif col_idx in (21, 22, 23, 24, 25, 26, 27, 28):
                cell.number_format = '#,##0'  # Currency format
                cell.alignment = Alignment(horizontal="right")

    # Auto-adjust column widths
    for col in ws_data.columns:
        col_letter = get_column_letter(col[0].column)
        max_len = max(len(str(cell.value or '')) for cell in col)
        ws_data.column_dimensions[col_letter].width = max(max_len + 3, 12)

    stream = io.BytesIO()
    wb.save(stream)
    stream.seek(0)

    filename = f"Sadam_Gadget_{period}_{datetime.now(WIB).strftime('%Y%m%d_%H%M%S')}.xlsx"
    return Response(
        content=stream.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
