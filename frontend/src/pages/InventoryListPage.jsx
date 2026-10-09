import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import StatusBadge from "@/components/StatusBadge";
import { formatRupiah, formatTanggalID } from "@/lib/format";
import { Plus, Search, Eye, Pencil } from "lucide-react";
import { useAuth } from "@/lib/auth";

export default function InventoryListPage() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [kondisi, setKondisi] = useState("ALL");
  const [status, setStatus] = useState("ALL");

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (q) params.q = q;
      if (kondisi !== "ALL") params.kondisi = kondisi;
      if (status !== "ALL") params.status_stok = status;
      const { data } = await api.get("/inventory", { params });
      setItems(data);
      setErr("");
    } catch (e) {
      setErr(formatApiErrorDetail(e?.response?.data?.detail) || e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const showFin = ["owner", "admin"].includes(user?.role);

  return (
    <div className="space-y-5" data-testid="inventory-list-page">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Inventaris HP</h1>
          <p className="text-slate-500">Kelola stok smartphone per unit.</p>
        </div>
        <Link to="/admin/inventaris/baru">
          <Button className="bg-[#0052FF] hover:bg-[#0040CC]" data-testid="btn-add-unit">
            <Plus className="w-4 h-4 mr-1.5" /> Tambah Unit
          </Button>
        </Link>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Cari IMEI, merek, model, SN..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
              data-testid="inv-search"
            />
          </div>
          <Select value={kondisi} onValueChange={setKondisi}>
            <SelectTrigger data-testid="inv-filter-kondisi"><SelectValue placeholder="Kondisi" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Kondisi</SelectItem>
              <SelectItem value="BARU">BARU</SelectItem>
              <SelectItem value="BEKAS">BEKAS</SelectItem>
              <SelectItem value="REFURBISHED">REFURBISHED</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger data-testid="inv-filter-status"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Status</SelectItem>
              <SelectItem value="TERSEDIA">TERSEDIA</SelectItem>
              <SelectItem value="HOLD">HOLD</SelectItem>
              <SelectItem value="TERJUAL">TERJUAL</SelectItem>
              <SelectItem value="SERVIS">SERVIS</SelectItem>
              <SelectItem value="DIARSIPKAN">DIARSIPKAN</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex justify-end mt-3">
          <Button variant="outline" size="sm" onClick={load} data-testid="btn-apply-filter">Terapkan</Button>
        </div>
      </Card>

      {err && <p className="text-rose-600 text-sm" data-testid="inv-error">{err}</p>}

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr className="text-left">
                <th className="px-4 py-3">Tanggal</th>
                <th className="px-4 py-3">Produk</th>
                <th className="px-4 py-3">IMEI 1</th>
                <th className="px-4 py-3">Kondisi</th>
                <th className="px-4 py-3">Jenis</th>
                {showFin && <th className="px-4 py-3 text-right">Modal</th>}
                <th className="px-4 py-3 text-right">Harga Jual</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="py-10 text-center text-slate-500">Memuat data...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={9} className="py-10 text-center text-slate-500">Belum ada unit. Klik "Tambah Unit" untuk mulai.</td></tr>
              ) : items.map((it) => (
                <tr key={it.id} className="border-t hover:bg-slate-50" data-testid={`inv-row-${it.id}`}>
                  <td className="px-4 py-3 whitespace-nowrap font-mono-tabular text-xs text-slate-600">{it.tanggal_input_fmt || formatTanggalID(it.tanggal_input)}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{it.merek} {it.model}</div>
                    <div className="text-xs text-slate-500">{[it.ram, it.penyimpanan, it.warna].filter(Boolean).join(" · ")}</div>
                  </td>
                  <td className="px-4 py-3 font-mono-tabular text-xs">{it.imei_1}</td>
                  <td className="px-4 py-3"><span className="text-xs font-medium">{it.kondisi}</span></td>
                  <td className="px-4 py-3"><span className="text-xs">{it.jenis_perangkat}</span></td>
                  {showFin && <td className="px-4 py-3 text-right font-mono-tabular text-xs">{formatRupiah(it.total_modal)}</td>}
                  <td className="px-4 py-3 text-right font-mono-tabular text-xs">{formatRupiah(it.harga_jual)}</td>
                  <td className="px-4 py-3"><StatusBadge status={it.status_stok} /></td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1">
                      <Link to={`/admin/inventaris/${it.id}`}>
                        <Button size="icon" variant="ghost" data-testid={`btn-view-${it.id}`}><Eye className="w-4 h-4" /></Button>
                      </Link>
                      <Link to={`/admin/inventaris/${it.id}/edit`}>
                        <Button size="icon" variant="ghost" data-testid={`btn-edit-${it.id}`}><Pencil className="w-4 h-4" /></Button>
                      </Link>
                    </div>
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
