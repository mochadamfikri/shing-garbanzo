import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, formatApiErrorDetail } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { formatRupiah, formatTanggalID } from "@/lib/format";
import { OrderStatusBadge } from "@/pages/PesananPage";
import { ArrowLeft, Check, X, Truck } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const resolveUrl = (u) => (!u ? null : u.startsWith("http") ? u : `${BACKEND_URL}${u}`);

export default function OrderAdminDetailPage() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [err, setErr] = useState("");
  const [catatan, setCatatan] = useState("");
  const [resi, setResi] = useState({ nomor_resi: "", estimasi_sampai: "", status_pengiriman: "DIKEMAS", catatan_admin: "" });
  const [busy, setBusy] = useState(false);

  const load = () => api.get(`/orders/${id}`)
    .then((r) => {
      setOrder(r.data);
      setResi({
        nomor_resi: r.data.nomor_resi || "",
        estimasi_sampai: r.data.estimasi_sampai || "",
        status_pengiriman: r.data.status_pengiriman || "DIKEMAS",
        catatan_admin: r.data.catatan_admin || "",
      });
    })
    .catch((e) => setErr(formatApiErrorDetail(e?.response?.data?.detail) || e.message));

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const verifikasi = async (diterima) => {
    if (!window.confirm(diterima ? "Terima pembayaran dan proses pesanan?" : "Tolak pembayaran dan batalkan pesanan?")) return;
    setBusy(true);
    try {
      await api.post(`/orders/${id}/verifikasi-bayar`, { diterima, catatan });
      toast.success(diterima ? "Pembayaran diterima" : "Pembayaran ditolak");
      await load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e?.response?.data?.detail) || "Gagal");
    } finally {
      setBusy(false);
    }
  };

  const saveResi = async () => {
    setBusy(true);
    try {
      await api.patch(`/orders/${id}/resi`, {
        nomor_resi: resi.nomor_resi || null,
        estimasi_sampai: resi.estimasi_sampai || null,
        status_pengiriman: resi.status_pengiriman || null,
        catatan_admin: resi.catatan_admin || null,
        tanggal_kirim: resi.status_pengiriman === "DIKIRIM" ? new Date().toISOString() : null,
      });
      toast.success("Pengiriman diperbarui");
      await load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e?.response?.data?.detail) || "Gagal");
    } finally {
      setBusy(false);
    }
  };

  if (err) return <p className="text-rose-600">{err}</p>;
  if (!order) return <p className="text-slate-500">Memuat...</p>;

  const canVerify = ["MENUNGGU_BAYAR", "MENUNGGU_VERIFIKASI"].includes(order.status_pesanan);
  const canShip = ["DIPROSES", "DIKIRIM"].includes(order.status_pesanan);

  return (
    <div className="space-y-5" data-testid="admin-order-detail">
      <Link to="/admin/pesanan" className="inline-flex items-center text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="w-4 h-4 mr-1.5" /> Semua pesanan
      </Link>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading font-bold text-2xl md:text-3xl font-mono-tabular">{order.nomor_pesanan}</h1>
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            <OrderStatusBadge status={order.status_pesanan} />
            <span className="text-sm text-slate-500">{order.created_at_fmt}</span>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-5">
        <div className="md:col-span-2 space-y-5">
          <Card className="p-5">
            <h2 className="font-heading font-semibold mb-3">Pelanggan</h2>
            <p className="font-medium">{order.nama_pelanggan}</p>
            <p className="text-sm text-slate-500">{order.email} · {order.telepon}</p>
            <div className="mt-3 pt-3 border-t">
              <p className="font-medium">Alamat pengiriman</p>
              <p className="text-sm">{order.alamat_snapshot.nama_penerima} · {order.alamat_snapshot.telepon_penerima}</p>
              <p className="text-sm text-slate-700">{order.alamat_snapshot.alamat_lengkap}</p>
              <p className="text-xs text-slate-500">
                {[order.alamat_snapshot.kelurahan, order.alamat_snapshot.kecamatan, order.alamat_snapshot.kabupaten, order.alamat_snapshot.provinsi, order.alamat_snapshot.kode_pos].filter(Boolean).join(", ")}
              </p>
            </div>
            {order.catatan_pelanggan && (
              <div className="mt-3 p-3 bg-slate-50 rounded-md text-sm">
                <p className="text-xs text-slate-500">Catatan pelanggan:</p>
                {order.catatan_pelanggan}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="font-heading font-semibold mb-3">Item</h2>
            <div className="divide-y">
              {order.items.map((it) => (
                <div key={it.unit_id} className="flex gap-3 py-3">
                  {it.foto_utama && <img src={resolveUrl(it.foto_utama)} className="w-16 h-16 rounded-md object-cover bg-slate-100" alt="" />}
                  <div className="flex-1">
                    <p className="font-medium">{it.merek} {it.model}</p>
                    <p className="text-xs text-slate-500">{[it.varian, it.warna].filter(Boolean).join(" · ")}</p>
                    <Link to={`/admin/inventaris/${it.unit_id}`} className="text-xs text-[#0052FF] hover:underline">Lihat unit →</Link>
                  </div>
                  <span className="font-mono-tabular">{formatRupiah(it.harga_jual)}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span className="font-mono-tabular">{formatRupiah(order.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Ongkir ({order.metode_pengiriman.nama})</span><span className="font-mono-tabular">{formatRupiah(order.biaya_kirim)}</span></div>
              <div className="flex justify-between font-semibold pt-2 border-t"><span>Total</span><span className="font-mono-tabular">{formatRupiah(order.total)}</span></div>
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="p-5">
            <h2 className="font-heading font-semibold mb-2">Pembayaran</h2>
            <p className="text-sm text-slate-500">Metode: {order.metode_pembayaran.nama}</p>
            <p className="text-sm">Status: <span className="font-medium">{order.status_pembayaran.replace("_", " ")}</span></p>
            {order.bukti_bayar_url ? (
              <>
                <img src={resolveUrl(order.bukti_bayar_url)} alt="Bukti" className="w-full rounded-md border mt-3" data-testid="admin-bukti-img" />
                <p className="text-xs text-slate-500 mt-2">Diunggah: {order.bukti_bayar_at ? formatTanggalID(order.bukti_bayar_at) : "-"}</p>
              </>
            ) : (
              <p className="text-sm text-slate-400 mt-2">Belum ada bukti bayar.</p>
            )}
            {canVerify && order.bukti_bayar_url && (
              <div className="mt-3 space-y-2">
                <Label className="text-xs">Catatan (opsional)</Label>
                <Textarea rows={2} value={catatan} onChange={(e) => setCatatan(e.target.value)} data-testid="admin-verify-catatan" />
                <div className="flex gap-2">
                  <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => verifikasi(true)} disabled={busy} data-testid="btn-verify-accept">
                    <Check className="w-4 h-4 mr-1.5" /> Terima
                  </Button>
                  <Button className="flex-1 bg-rose-600 hover:bg-rose-700" onClick={() => verifikasi(false)} disabled={busy} data-testid="btn-verify-reject">
                    <X className="w-4 h-4 mr-1.5" /> Tolak
                  </Button>
                </div>
              </div>
            )}
            {order.catatan_admin && <p className="text-xs text-slate-500 mt-3">Catatan admin: {order.catatan_admin}</p>}
          </Card>

          {canShip && (
            <Card className="p-5">
              <h2 className="font-heading font-semibold flex items-center gap-2 mb-3"><Truck className="w-4 h-4" /> Pengiriman</h2>
              <div className="space-y-3">
                <div><Label>Nomor resi</Label><Input value={resi.nomor_resi} onChange={(e) => setResi({ ...resi, nomor_resi: e.target.value })} className="font-mono-tabular" data-testid="input-resi" /></div>
                <div><Label>Estimasi sampai</Label><Input value={resi.estimasi_sampai} onChange={(e) => setResi({ ...resi, estimasi_sampai: e.target.value })} placeholder="2-3 hari kerja" /></div>
                <div>
                  <Label>Status pengiriman</Label>
                  <Select value={resi.status_pengiriman} onValueChange={(v) => setResi({ ...resi, status_pengiriman: v })}>
                    <SelectTrigger data-testid="select-status-kirim"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MENUNGGU">MENUNGGU</SelectItem>
                      <SelectItem value="DIKEMAS">DIKEMAS</SelectItem>
                      <SelectItem value="DIKIRIM">DIKIRIM</SelectItem>
                      <SelectItem value="DITERIMA">DITERIMA</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full bg-[#0052FF] hover:bg-[#0040CC]" onClick={saveResi} disabled={busy} data-testid="btn-save-resi">
                  Simpan Pengiriman
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
