import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatRupiah } from "@/lib/format";
import { OrderStatusBadge } from "@/pages/PesananPage";
import { Eye, Package } from "lucide-react";

export default function OrdersAdminPage() {
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState("ALL");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const params = {};
    if (status !== "ALL") params.status = status;
    try {
      const { data } = await api.get("/orders", { params });
      setOrders(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);

  return (
    <div className="space-y-5" data-testid="orders-admin-page">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-heading font-bold text-3xl">Pesanan</h1>
          <p className="text-slate-500">Verifikasi pembayaran, input resi, dan status pengiriman.</p>
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-48" data-testid="orders-filter-status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Semua Status</SelectItem>
            <SelectItem value="MENUNGGU_BAYAR">Menunggu Bayar</SelectItem>
            <SelectItem value="MENUNGGU_VERIFIKASI">Menunggu Verifikasi</SelectItem>
            <SelectItem value="DIPROSES">Diproses</SelectItem>
            <SelectItem value="DIKIRIM">Dikirim</SelectItem>
            <SelectItem value="SELESAI">Selesai</SelectItem>
            <SelectItem value="DIBATALKAN">Dibatalkan</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-left">
              <tr>
                <th className="px-4 py-3">Nomor</th>
                <th className="px-4 py-3">Tanggal</th>
                <th className="px-4 py-3">Pelanggan</th>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="py-10 text-center text-slate-500">Memuat...</td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={7} className="py-10 text-center text-slate-500">
                  <Package className="w-10 h-10 mx-auto text-slate-400 mb-2" /> Belum ada pesanan.
                </td></tr>
              ) : orders.map((o) => (
                <tr key={o.id} className="border-t hover:bg-slate-50" data-testid={`admin-order-row-${o.id}`}>
                  <td className="px-4 py-3 font-mono-tabular font-medium">{o.nomor_pesanan}</td>
                  <td className="px-4 py-3 font-mono-tabular text-xs">{o.created_at_fmt}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{o.nama_pelanggan}</p>
                    <p className="text-xs text-slate-500">{o.telepon}</p>
                  </td>
                  <td className="px-4 py-3">{o.items.length} unit</td>
                  <td className="px-4 py-3 text-right font-mono-tabular font-medium">{formatRupiah(o.total)}</td>
                  <td className="px-4 py-3"><OrderStatusBadge status={o.status_pesanan} /></td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/admin/pesanan/${o.id}`}>
                      <Button size="icon" variant="ghost" data-testid={`btn-admin-view-${o.id}`}><Eye className="w-4 h-4" /></Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
