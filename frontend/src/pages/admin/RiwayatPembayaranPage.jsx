import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatRupiah, formatTanggalID } from "@/lib/format";
import { QrCode, RefreshCw, ExternalLink, Download } from "lucide-react";

const STATUS_LABEL = {
  DIPROSES: { t: "Diproses", c: "text-emerald-600 bg-emerald-50" },
  DIKIRIM: { t: "Dikirim", c: "text-blue-600 bg-blue-50" },
  SELESAI: { t: "Selesai", c: "text-slate-600 bg-slate-100" },
  MENUNGGU_BAYAR: { t: "Menunggu Bayar", c: "text-amber-600 bg-amber-50" },
};

export default function RiwayatPembayaranPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    api.get("/orders/admin/pembayaran-qris", { params: { start: start || undefined, end: end || undefined } })
      .then((r) => setItems(r.data))
      .finally(() => setLoading(false));
  }, [start, end]);

  useEffect(() => { load(); }, [load]);

  const downloadCsv = () => {
    api.get("/orders/admin/pembayaran-qris/csv", { params: { start: start || undefined, end: end || undefined }, responseType: "blob" })
      .then((r) => {
        const url = window.URL.createObjectURL(new Blob([r.data]));
        const a = document.createElement("a");
        a.href = url;
        a.download = "pembayaran-qris.csv";
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      });
  };

  const totalMasuk = items.reduce((s, o) => s + (o.total || 0), 0);

  return (
    <div className="space-y-6" data-testid="riwayat-qris-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading font-bold text-2xl md:text-3xl flex items-center gap-2">
            <QrCode className="w-6 h-6 text-indigo-600" /> Riwayat Pembayaran QRIS
          </h1>
          <p className="text-slate-500 text-sm mt-1">Semua pembayaran QRIS (Kasera) yang telah masuk.</p>
        </div>
        <div className="flex items-end gap-2 flex-wrap">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Dari tanggal</label>
            <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="h-9 w-40" data-testid="filter-start" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Sampai tanggal</label>
            <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="h-9 w-40" data-testid="filter-end" />
          </div>
          <Button variant="outline" size="sm" onClick={load} data-testid="btn-apply-filter">
            <RefreshCw className="w-4 h-4 mr-1.5" /> Terapkan
          </Button>
          <Button size="sm" onClick={downloadCsv} data-testid="btn-download-csv">
            <Download className="w-4 h-4 mr-1.5" /> Unduh CSV
          </Button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Card className="p-5">
          <p className="text-xs uppercase tracking-widest text-slate-500">Jumlah Transaksi</p>
          <p className="font-heading font-bold text-3xl mt-1 font-mono-tabular" data-testid="riwayat-count">{items.length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs uppercase tracking-widest text-slate-500">Total Nilai Masuk</p>
          <p className="font-heading font-bold text-3xl mt-1 font-mono-tabular text-emerald-600" data-testid="riwayat-total">{formatRupiah(totalMasuk)}</p>
        </Card>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-slate-500">Memuat...</p>
        ) : items.length === 0 ? (
          <p className="p-10 text-center text-slate-500" data-testid="riwayat-empty">Belum ada pembayaran QRIS yang masuk.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Nomor Pesanan</th>
                  <th className="px-4 py-3 font-medium">Waktu Bayar</th>
                  <th className="px-4 py-3 font-medium text-right">Nominal</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((o) => {
                  const st = STATUS_LABEL[o.status_pesanan] || { t: o.status_pesanan, c: "text-slate-600 bg-slate-100" };
                  return (
                    <tr key={o.id} className="hover:bg-slate-50" data-testid={`riwayat-row-${o.id}`}>
                      <td className="px-4 py-3 font-mono-tabular font-medium">{o.nomor_pesanan}</td>
                      <td className="px-4 py-3 text-slate-600">{o.qris_paid_at ? formatTanggalID(o.qris_paid_at) : "-"}</td>
                      <td className="px-4 py-3 text-right font-mono-tabular">{formatRupiah(o.total)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${st.c}`}>{st.t}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link to={`/admin/pesanan/${o.id}`} className="inline-flex items-center text-indigo-600 hover:underline" data-testid={`riwayat-detail-${o.id}`}>
                          Detail <ExternalLink className="w-3.5 h-3.5 ml-1" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
