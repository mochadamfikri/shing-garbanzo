import { useEffect, useState } from "react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { formatRupiah, parseRupiahInput } from "@/lib/format";
import { Plus, Trash2 } from "lucide-react";

const KATEGORI = ["SEWA", "LISTRIK", "INTERNET", "GAJI", "PEMASARAN", "KEMASAN", "LOGISTIK", "LAINNYA"];

export default function PengeluaranPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    kategori: "LISTRIK", nominal: 0, tanggal: new Date().toISOString().slice(0, 10), keterangan: "",
  });

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/expenses");
      setItems(data);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.nominal || form.nominal <= 0) return toast.error("Nominal harus > 0");
    try {
      await api.post("/expenses", form);
      toast.success("Pengeluaran ditambahkan");
      setOpen(false);
      setForm({ kategori: "LISTRIK", nominal: 0, tanggal: new Date().toISOString().slice(0, 10), keterangan: "" });
      await load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e?.response?.data?.detail) || "Gagal");
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Hapus pengeluaran ini?")) return;
    try { await api.delete(`/expenses/${id}`); toast.success("Dihapus"); await load(); }
    catch { toast.error("Gagal"); }
  };

  const total = items.reduce((s, x) => s + Number(x.nominal || 0), 0);

  return (
    <div className="space-y-5" data-testid="pengeluaran-page">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-heading font-bold text-3xl">Pengeluaran Operasional</h1>
          <p className="text-slate-500">Catat biaya sewa, listrik, gaji, dsb untuk perhitungan laba bersih.</p>
        </div>
        {!open && (
          <Button className="bg-[#0052FF] hover:bg-[#0040CC]" onClick={() => setOpen(true)} data-testid="btn-add-expense">
            <Plus className="w-4 h-4 mr-1.5" /> Tambah Pengeluaran
          </Button>
        )}
      </div>

      {open && (
        <Card className="p-5">
          <h2 className="font-heading font-semibold mb-3">Pengeluaran Baru</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <Label>Kategori</Label>
              <Select value={form.kategori} onValueChange={(v) => setForm({ ...form, kategori: v })}>
                <SelectTrigger data-testid="exp-kategori"><SelectValue /></SelectTrigger>
                <SelectContent>{KATEGORI.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nominal</Label>
              <Input inputMode="numeric" value={form.nominal ? Number(form.nominal).toLocaleString("id-ID") : ""}
                     onChange={(e) => setForm({ ...form, nominal: parseRupiahInput(e.target.value) })}
                     className="font-mono-tabular" data-testid="exp-nominal" />
            </div>
            <div><Label>Tanggal</Label><Input type="date" value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} data-testid="exp-tanggal" /></div>
            <div><Label>Keterangan</Label><Input value={form.keterangan} onChange={(e) => setForm({ ...form, keterangan: e.target.value })} data-testid="exp-keterangan" /></div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setOpen(false)} data-testid="btn-exp-cancel">Batal</Button>
            <Button onClick={save} data-testid="btn-exp-save">Simpan</Button>
          </div>
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-left">
              <tr><th className="px-4 py-3">Tanggal</th><th className="px-4 py-3">Kategori</th><th className="px-4 py-3">Keterangan</th><th className="px-4 py-3 text-right">Nominal</th><th className="px-4 py-3 text-right">Aksi</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="py-10 text-center text-slate-500">Memuat...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={5} className="py-10 text-center text-slate-500">Belum ada pengeluaran.</td></tr>
              ) : items.map((x) => (
                <tr key={x.id} className="border-t hover:bg-slate-50" data-testid={`exp-row-${x.id}`}>
                  <td className="px-4 py-3 font-mono-tabular text-xs">{x.tanggal_fmt}</td>
                  <td className="px-4 py-3"><span className="text-xs uppercase tracking-wide font-medium bg-slate-100 rounded-full px-2 py-0.5">{x.kategori}</span></td>
                  <td className="px-4 py-3 text-slate-700">{x.keterangan || "-"}</td>
                  <td className="px-4 py-3 text-right font-mono-tabular font-medium">{formatRupiah(x.nominal)}</td>
                  <td className="px-4 py-3 text-right"><Button size="icon" variant="ghost" onClick={() => remove(x.id)} data-testid={`btn-exp-del-${x.id}`}><Trash2 className="w-4 h-4 text-rose-600" /></Button></td>
                </tr>
              ))}
            </tbody>
            {items.length > 0 && (
              <tfoot>
                <tr className="border-t bg-slate-50 font-semibold">
                  <td colSpan={3} className="px-4 py-3">Total</td>
                  <td className="px-4 py-3 text-right font-mono-tabular">{formatRupiah(total)}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>
    </div>
  );
}
