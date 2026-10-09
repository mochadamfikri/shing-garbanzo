import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { api, formatApiErrorDetail } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatRupiah, formatTanggalID } from "@/lib/format";
import { ArrowLeft, Upload, Package, MapPin, Truck } from "lucide-react";
import { OrderStatusBadge } from "@/pages/PesananPage";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const resolveUrl = (u) => (!u ? null : u.startsWith("http") ? u : `${BACKEND_URL}${u}`);

export default function PesananDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [order, setOrder] = useState(null);
  const [err, setErr] = useState("");
  const [uploading, setUploading] = useState(false);

  const load = () => api.get(`/orders/${id}`)
    .then((r) => setOrder(r.data))
    .catch((e) => setErr(formatApiErrorDetail(e?.response?.data?.detail) || e.message));

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const onUploadBukti = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const { data: up } = await api.post("/uploads/image", fd, { headers: { "Content-Type": "multipart/form-data" } });
      await api.post(`/orders/${id}/bukti-bayar`, { url: up.url });
      toast.success("Bukti pembayaran terkirim. Menunggu verifikasi admin.");
      await load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err?.response?.data?.detail) || "Gagal upload");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const batalkan = async () => {
    if (!window.confirm("Yakin membatalkan pesanan? Stok akan dilepas.")) return;
    try {
      await api.post(`/orders/${id}/batal`);
      toast.success("Pesanan dibatalkan");
      await load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e?.response?.data?.detail) || "Gagal");
    }
  };

  if (err) return <div className="max-w-3xl mx-auto p-10 text-rose-600">{err}</div>;
  if (!order) return <div className="max-w-3xl mx-auto p-10 text-slate-500">Memuat...</div>;

  const canUpload = ["MENUNGGU_BAYAR", "MENUNGGU_VERIFIKASI"].includes(order.status_pesanan);
  const canCancel = ["MENUNGGU_BAYAR", "MENUNGGU_VERIFIKASI"].includes(order.status_pesanan);

  return (
    <div className="max-w-5xl mx-auto px-5 py-8 space-y-5" data-testid="pesanan-detail">
      <Link to="/pesanan" className="inline-flex items-center text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="w-4 h-4 mr-1.5" /> Semua pesanan
      </Link>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading font-bold text-2xl md:text-3xl font-mono-tabular">{order.nomor_pesanan}</h1>
          <div className="flex items-center gap-2 mt-1">
            <OrderStatusBadge status={order.status_pesanan} />
            <span className="text-sm text-slate-500">{order.created_at_fmt}</span>
          </div>
        </div>
        {canCancel && <Button variant="outline" size="sm" onClick={batalkan} data-testid="btn-cancel-order">Batalkan Pesanan</Button>}
      </div>

      {order.status_pesanan === "MENUNGGU_BAYAR" && (
        <Card className="p-5 border-amber-200 bg-amber-50">
          <h2 className="font-heading font-semibold text-amber-900 mb-2">Instruksi Pembayaran</h2>
          <p className="text-sm text-amber-800">
            Transfer sejumlah <span className="font-mono-tabular font-bold">{formatRupiah(order.total)}</span> menggunakan <span className="font-semibold">{order.metode_pembayaran.nama}</span>, lalu upload bukti bayar di bawah.
          </p>
          <div className="mt-3">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <Upload className="w-4 h-4" />
              <span className="text-sm font-medium">{uploading ? "Mengunggah..." : "Upload Bukti Transfer"}</span>
              <input type="file" accept="image/*" className="hidden" onChange={onUploadBukti} disabled={uploading || !canUpload} data-testid="input-upload-bukti" />
            </label>
          </div>
        </Card>
      )}

      {order.bukti_bayar_url && (
        <Card className="p-5">
          <h2 className="font-heading font-semibold mb-3">Bukti Pembayaran</h2>
          <img src={resolveUrl(order.bukti_bayar_url)} alt="Bukti transfer" className="max-w-sm rounded-md border" />
          <p className="text-xs text-slate-500 mt-2">Diunggah: {order.bukti_bayar_at ? formatTanggalID(order.bukti_bayar_at) : "-"}</p>
          <div className="text-sm mt-2 flex items-center gap-2">Status: <Badge className="font-medium">{order.status_pembayaran.replace("_", " ")}</Badge></div>
          {order.catatan_admin && <p className="text-sm text-slate-600 mt-2">Catatan admin: {order.catatan_admin}</p>}
        </Card>
      )}

      <Card className="p-5">
        <h2 className="font-heading font-semibold flex items-center gap-2 mb-3"><Package className="w-4 h-4" /> Item Pesanan</h2>
        <div className="divide-y">
          {order.items.map((it) => (
            <div key={it.unit_id} className="flex gap-3 py-3">
              {it.foto_utama && <img src={resolveUrl(it.foto_utama)} className="w-16 h-16 rounded-md object-cover bg-slate-100" alt="" />}
              <div className="flex-1">
                <p className="font-medium">{it.merek} {it.model}</p>
                <p className="text-xs text-slate-500">{[it.varian, it.warna].filter(Boolean).join(" · ")}</p>
              </div>
              <span className="font-mono-tabular">{formatRupiah(it.harga_jual)}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span className="font-mono-tabular">{formatRupiah(order.subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Biaya kirim ({order.metode_pengiriman.nama})</span><span className="font-mono-tabular">{formatRupiah(order.biaya_kirim)}</span></div>
          <div className="flex justify-between font-semibold text-base pt-2 border-t"><span>Total</span><span className="font-mono-tabular">{formatRupiah(order.total)}</span></div>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="font-heading font-semibold flex items-center gap-2 mb-3"><MapPin className="w-4 h-4" /> Alamat Pengiriman</h2>
        <p className="font-medium">{order.alamat_snapshot.nama_penerima} · <span className="text-slate-500 font-normal">{order.alamat_snapshot.telepon_penerima}</span></p>
        <p className="text-sm text-slate-700 mt-1">{order.alamat_snapshot.alamat_lengkap}</p>
        <p className="text-xs text-slate-500 mt-1">
          {[order.alamat_snapshot.kelurahan, order.alamat_snapshot.kecamatan, order.alamat_snapshot.kabupaten, order.alamat_snapshot.provinsi, order.alamat_snapshot.kode_pos].filter(Boolean).join(", ")}
        </p>
      </Card>

      {["DIPROSES","DIKIRIM","SELESAI"].includes(order.status_pesanan) && (
        <Card className="p-5">
          <h2 className="font-heading font-semibold flex items-center gap-2 mb-3"><Truck className="w-4 h-4" /> Pengiriman</h2>
          <div className="grid md:grid-cols-2 gap-3 text-sm">
            <div><p className="text-xs text-slate-500 uppercase tracking-wide">Jasa Kirim</p><p>{order.metode_pengiriman.nama}</p></div>
            <div><p className="text-xs text-slate-500 uppercase tracking-wide">Nomor Resi</p><p className="font-mono-tabular">{order.nomor_resi || "-"}</p></div>
            <div><p className="text-xs text-slate-500 uppercase tracking-wide">Tanggal Kirim</p><p>{order.tanggal_kirim ? formatTanggalID(order.tanggal_kirim) : "-"}</p></div>
            <div><p className="text-xs text-slate-500 uppercase tracking-wide">Estimasi Sampai</p><p>{order.estimasi_sampai || "-"}</p></div>
          </div>
        </Card>
      )}
    </div>
  );
}
