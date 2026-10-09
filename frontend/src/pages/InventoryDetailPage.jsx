import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, formatApiErrorDetail } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Pencil } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import { formatRupiah, formatTanggalID } from "@/lib/format";
import { useAuth } from "@/lib/auth";

export default function InventoryDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
  const resolveUrl = (u) => (u?.startsWith("http") ? u : `${BACKEND_URL}${u}`);

  useEffect(() => {
    api.get(`/inventory/${id}`)
      .then((r) => setData(r.data))
      .catch((e) => setErr(formatApiErrorDetail(e?.response?.data?.detail) || e.message));
  }, [id]);

  const showFin = ["owner", "admin"].includes(user?.role);

  if (err) return <p className="text-rose-600" data-testid="detail-error">{err}</p>;
  if (!data) return <p className="text-slate-500">Memuat...</p>;

  return (
    <div className="space-y-5" data-testid="inventory-detail-page">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/admin/inventaris"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
          <div>
            <h1 className="font-heading text-2xl md:text-3xl font-bold tracking-tight">{data.merek} {data.model}</h1>
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge status={data.status_stok} />
              <StatusBadge status={data.status_publikasi} />
              <span className="text-xs text-slate-500">· {data.tanggal_input_fmt || formatTanggalID(data.tanggal_input)}</span>
            </div>
          </div>
        </div>
        <Link to={`/admin/inventaris/${id}/edit`}>
          <Button className="bg-[#0052FF] hover:bg-[#0040CC]" data-testid="btn-edit-detail"><Pencil className="w-4 h-4 mr-1.5" /> Edit</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card className="p-5">
            <h2 className="font-heading font-semibold mb-3">Spesifikasi</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              {[
                ["Varian", data.varian], ["Warna", data.warna],
                ["RAM", data.ram], ["Penyimpanan", data.penyimpanan],
                ["Jenis", data.jenis_perangkat], ["Kondisi", data.kondisi],
                ["Grade", data.grade_fisik], ["Baterai", data.kesehatan_baterai ? `${data.kesehatan_baterai}%` : "-"],
                ["Garansi", data.garansi], ["Kelengkapan", data.kelengkapan],
              ].map(([k, v]) => (
                <div key={k}><p className="text-slate-500 text-xs uppercase tracking-wide">{k}</p><p>{v || "-"}</p></div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="font-heading font-semibold mb-3">Identitas Unit</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div><p className="text-slate-500 text-xs uppercase tracking-wide">IMEI 1</p><p className="font-mono-tabular">{data.imei_1}</p></div>
              <div><p className="text-slate-500 text-xs uppercase tracking-wide">IMEI 2</p><p className="font-mono-tabular">{data.imei_2 || "-"}</p></div>
              <div><p className="text-slate-500 text-xs uppercase tracking-wide">Serial Number</p><p className="font-mono-tabular">{data.serial_number || "-"}</p></div>
              {showFin && <div><p className="text-slate-500 text-xs uppercase tracking-wide">Supplier</p><p>{data.supplier || "-"}</p></div>}
            </div>
            {data.catatan_pemeriksaan && (
              <div className="mt-4 p-3 bg-slate-50 rounded-md text-sm">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Catatan Pemeriksaan</p>
                {data.catatan_pemeriksaan}
              </div>
            )}
          </Card>

          {(data.foto_urls?.length || data.video_urls?.length) ? (
            <Card className="p-5">
              <h2 className="font-heading font-semibold mb-3">Media</h2>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-2 mb-3">
                {(data.foto_urls || []).map((u) => (
                  <div key={u} className="aspect-square rounded-md overflow-hidden bg-slate-100">
                    <img src={resolveUrl(u)} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {(data.video_urls || []).map((u) => <video key={u} src={resolveUrl(u)} controls className="w-full rounded-md" />)}
              </div>
            </Card>
          ) : null}

          {data.deskripsi && (
            <Card className="p-5">
              <h2 className="font-heading font-semibold mb-2">Deskripsi</h2>
              <p className="text-sm text-slate-700 whitespace-pre-line">{data.deskripsi}</p>
            </Card>
          )}

          {(data.history_harga?.length || data.history_status?.length) ? (
            <Card className="p-5" data-testid="riwayat-section">
              <h2 className="font-heading font-semibold mb-3">Riwayat Perubahan</h2>
              <div className="grid md:grid-cols-2 gap-5">
                <div>
                  <h3 className="text-xs uppercase tracking-widest text-slate-500 mb-2">Harga Jual</h3>
                  {(data.history_harga || []).length === 0 ? (
                    <p className="text-sm text-slate-400">Belum ada perubahan.</p>
                  ) : (
                    <ul className="space-y-2 text-sm" data-testid="riwayat-harga">
                      {(data.history_harga || []).slice().reverse().map((h, idx) => (
                        <li key={idx} className="flex items-start justify-between gap-3 border-l-2 border-blue-200 pl-3">
                          <div>
                            <p className="font-mono-tabular font-medium">{formatRupiah(h.harga_jual)}</p>
                            <p className="text-xs text-slate-500">oleh {h.oleh || "-"}</p>
                          </div>
                          <span className="text-xs text-slate-500 font-mono-tabular whitespace-nowrap">{formatTanggalID(h.at)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <h3 className="text-xs uppercase tracking-widest text-slate-500 mb-2">Status Stok</h3>
                  {(data.history_status || []).length === 0 ? (
                    <p className="text-sm text-slate-400">Belum ada perubahan.</p>
                  ) : (
                    <ul className="space-y-2 text-sm" data-testid="riwayat-status">
                      {(data.history_status || []).slice().reverse().map((h, idx) => (
                        <li key={idx} className="flex items-start justify-between gap-3 border-l-2 border-amber-200 pl-3">
                          <div>
                            <StatusBadge status={h.status_stok} />
                            {h.alasan && <p className="text-xs text-slate-500 mt-1">Alasan: {h.alasan}</p>}
                            <p className="text-xs text-slate-500">oleh {h.oleh || "-"}</p>
                          </div>
                          <span className="text-xs text-slate-500 font-mono-tabular whitespace-nowrap">{formatTanggalID(h.at)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </Card>
          ) : null}
        </div>

        <div className="space-y-5">
          {showFin && (
            <Card className="p-5">
              <h2 className="font-heading font-semibold mb-3">Keuangan</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Harga Beli</span><span className="font-mono-tabular">{formatRupiah(data.harga_beli)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Biaya Reparasi</span><span className="font-mono-tabular">{formatRupiah(data.biaya_reparasi)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Biaya Tambahan</span><span className="font-mono-tabular">{formatRupiah(data.biaya_tambahan)}</span></div>
                <div className="flex justify-between border-t pt-2"><span className="font-medium">Total Modal</span><span className="font-mono-tabular font-semibold">{formatRupiah(data.total_modal)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Harga Jual</span><span className="font-mono-tabular">{formatRupiah(data.harga_jual)}</span></div>
                <div className="flex justify-between"><span className="font-medium">Estimasi Laba Kotor</span>
                  <span className={`font-mono-tabular font-semibold ${data.estimasi_laba_kotor >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {formatRupiah(data.estimasi_laba_kotor)}
                  </span>
                </div>
              </div>
            </Card>
          )}
          {!showFin && (
            <Card className="p-5">
              <h2 className="font-heading font-semibold mb-3">Harga</h2>
              <div className="flex justify-between"><span className="text-slate-500">Harga Jual</span><span className="font-mono-tabular font-semibold">{formatRupiah(data.harga_jual)}</span></div>
              <p className="text-xs text-slate-400 mt-2">Data modal disembunyikan untuk role Anda.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
