import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatRupiah } from "@/lib/format";
import { Package, ArrowRight } from "lucide-react";

const PESANAN_LABEL = {
  MENUNGGU_BAYAR: { text: "Menunggu Pembayaran", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  MENUNGGU_VERIFIKASI: { text: "Menunggu Verifikasi", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  DIPROSES: { text: "Diproses", cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  DIKIRIM: { text: "Dikirim", cls: "bg-purple-50 text-purple-700 border-purple-200" },
  SELESAI: { text: "Selesai", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  DIBATALKAN: { text: "Dibatalkan", cls: "bg-rose-50 text-rose-700 border-rose-200" },
  KEDALUWARSA: { text: "Kedaluwarsa", cls: "bg-zinc-100 text-zinc-700 border-zinc-200" },
};

export function OrderStatusBadge({ status }) {
  const s = PESANAN_LABEL[status] || PESANAN_LABEL.MENUNGGU_BAYAR;
  return <Badge className={`${s.cls} border font-medium`} data-testid={`order-status-${status}`}>{s.text}</Badge>;
}

export default function PesananPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/orders/mine")
      .then((r) => setOrders(r.data))
      .catch((e) => setErr(formatApiErrorDetail(e?.response?.data?.detail) || e.message))
      .finally(() => setLoading(false));
  }, []);

  if (user && user.role !== "pelanggan") {
    return <div className="max-w-3xl mx-auto p-10 text-slate-500">Halaman ini hanya untuk akun pelanggan.</div>;
  }

  return (
    <div className="max-w-6xl mx-auto px-5 py-8" data-testid="pesanan-page">
      <h1 className="font-heading font-bold text-3xl mb-5">Pesanan Saya</h1>
      {err && <p className="text-rose-600 text-sm">{err}</p>}
      {loading ? (
        <p className="text-slate-500">Memuat...</p>
      ) : orders.length === 0 ? (
        <div className="text-center text-slate-500 py-16 bg-slate-50 border border-slate-100 rounded-xl">
          <Package className="w-10 h-10 mx-auto text-slate-400 mb-2" />
          Belum ada pesanan. <Link to="/katalog" className="text-[#0052FF] underline">Mulai belanja</Link>.
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <Card key={o.id} className="p-5 flex flex-col md:flex-row md:items-center gap-3" data-testid={`order-row-${o.id}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-mono-tabular font-semibold">{o.nomor_pesanan}</p>
                  <OrderStatusBadge status={o.status_pesanan} />
                </div>
                <p className="text-sm text-slate-500 mt-1">{o.created_at_fmt} · {o.items.length} item</p>
                <p className="text-sm text-slate-700 truncate mt-1">
                  {o.items.slice(0, 2).map((i) => `${i.merek} ${i.model}`).join(", ")}
                  {o.items.length > 2 && `, +${o.items.length - 2} lainnya`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-xs text-slate-500">Total</p>
                  <p className="font-mono-tabular font-semibold">{formatRupiah(o.total)}</p>
                </div>
                <Link to={`/pesanan/${o.id}`}>
                  <Button variant="outline" size="sm" data-testid={`btn-order-detail-${o.id}`}>Detail <ArrowRight className="w-4 h-4 ml-1.5" /></Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
