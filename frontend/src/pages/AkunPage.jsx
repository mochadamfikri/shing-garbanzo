import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { api, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Trash2, Star, Pencil } from "lucide-react";

const EMPTY_ADDR = {
  nama_penerima: "", telepon_penerima: "",
  provinsi: "", kabupaten: "", kecamatan: "", kelurahan: "", kode_pos: "",
  alamat_lengkap: "", nomor_rumah: "", patokan: "", pin_lokasi: "", is_default: false,
};

function AddressForm({ initial, onSubmit, onCancel }) {
  const [v, setV] = useState(initial || EMPTY_ADDR);
  const set = (k, val) => setV((s) => ({ ...s, [k]: val }));
  return (
    <Card className="p-5">
      <h3 className="font-semibold mb-3">{initial ? "Edit Alamat" : "Tambah Alamat"}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div><Label>Nama penerima</Label><Input value={v.nama_penerima} onChange={(e) => set("nama_penerima", e.target.value)} data-testid="addr-nama" /></div>
        <div><Label>Telepon penerima</Label><Input value={v.telepon_penerima} onChange={(e) => set("telepon_penerima", e.target.value)} data-testid="addr-telepon" /></div>
        <div><Label>Provinsi</Label><Input value={v.provinsi} onChange={(e) => set("provinsi", e.target.value)} data-testid="addr-provinsi" /></div>
        <div><Label>Kabupaten/Kota</Label><Input value={v.kabupaten} onChange={(e) => set("kabupaten", e.target.value)} data-testid="addr-kabupaten" /></div>
        <div><Label>Kecamatan</Label><Input value={v.kecamatan} onChange={(e) => set("kecamatan", e.target.value)} data-testid="addr-kecamatan" /></div>
        <div><Label>Kelurahan/Desa</Label><Input value={v.kelurahan} onChange={(e) => set("kelurahan", e.target.value)} data-testid="addr-kelurahan" /></div>
        <div><Label>Kode pos</Label><Input value={v.kode_pos} onChange={(e) => set("kode_pos", e.target.value)} data-testid="addr-kodepos" /></div>
        <div><Label>No rumah/gedung</Label><Input value={v.nomor_rumah} onChange={(e) => set("nomor_rumah", e.target.value)} data-testid="addr-nomor" /></div>
      </div>
      <div className="mt-3"><Label>Alamat lengkap</Label><Textarea rows={2} value={v.alamat_lengkap} onChange={(e) => set("alamat_lengkap", e.target.value)} data-testid="addr-alamat" /></div>
      <div className="mt-3"><Label>Patokan / catatan (opsional)</Label><Input value={v.patokan} onChange={(e) => set("patokan", e.target.value)} data-testid="addr-patokan" /></div>
      <div className="mt-3 flex items-center gap-2">
        <Checkbox id="is_default" checked={v.is_default} onCheckedChange={(x) => set("is_default", !!x)} data-testid="addr-default" />
        <Label htmlFor="is_default" className="font-normal">Jadikan alamat utama</Label>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} data-testid="btn-addr-cancel">Batal</Button>
        <Button type="button" onClick={() => onSubmit(v)} data-testid="btn-addr-save">Simpan</Button>
      </div>
    </Card>
  );
}

export default function AkunPage() {
  const { user, refreshMe } = useAuth();
  const [addresses, setAddresses] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [consent, setConsent] = useState({ status: false, saluran: [] });

  useEffect(() => {
    if (user?.role === "pelanggan") {
      api.get("/customer/addresses").then((r) => setAddresses(r.data)).catch(() => {});
      const c = user.promo_consent || {};
      setConsent({ status: !!c.status, saluran: c.saluran || [] });
    }
  }, [user]);

  if (user === null) return null;
  if (!user) return <Navigate to="/masuk?redirect=/akun" replace />;
  if (user.role !== "pelanggan") return <Navigate to="/admin" replace />;

  const reload = async () => {
    const { data } = await api.get("/customer/addresses");
    setAddresses(data);
  };

  const handleSave = async (addr) => {
    try {
      if (editing) {
        await api.patch(`/customer/addresses/${editing.id}`, addr);
        toast.success("Alamat diperbarui");
      } else {
        await api.post("/customer/addresses", addr);
        toast.success("Alamat ditambahkan");
      }
      setFormOpen(false);
      setEditing(null);
      await reload();
    } catch (e) {
      toast.error(formatApiErrorDetail(e?.response?.data?.detail) || "Gagal");
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/customer/addresses/${id}`);
      toast.success("Alamat dihapus");
      await reload();
    } catch (e) {
      toast.error(formatApiErrorDetail(e?.response?.data?.detail) || "Gagal");
    }
  };

  const toggleSaluran = (ch) => {
    setConsent((s) => ({ ...s, saluran: s.saluran.includes(ch) ? s.saluran.filter((x) => x !== ch) : [...s.saluran, ch] }));
  };

  const saveConsent = async (status) => {
    try {
      const res = await api.patch("/customer/promo-consent", { setujui: status, saluran: status ? consent.saluran : [], versi: "v1.0" });
      setConsent({ status: !!res.data.promo_consent.status, saluran: res.data.promo_consent.saluran || [] });
      await refreshMe();
      toast.success(status ? "Persetujuan diperbarui" : "Persetujuan dicabut");
    } catch (e) {
      toast.error("Gagal menyimpan");
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-5 py-8 space-y-6" data-testid="akun-page">
      <div>
        <h1 className="font-heading font-bold text-3xl">Akun Saya</h1>
        <p className="text-slate-500">{user.nama} · {user.email}</p>
      </div>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading font-semibold text-lg">Alamat Pengiriman</h2>
          {!formOpen && (
            <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }} data-testid="btn-add-alamat">
              <Plus className="w-4 h-4 mr-1.5" /> Tambah Alamat
            </Button>
          )}
        </div>
        {formOpen ? (
          <AddressForm initial={editing} onSubmit={handleSave} onCancel={() => { setFormOpen(false); setEditing(null); }} />
        ) : addresses.length === 0 ? (
          <Card className="p-6 text-center text-slate-500 text-sm">Belum ada alamat tersimpan.</Card>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {addresses.map((a) => (
              <Card key={a.id} className="p-5" data-testid={`addr-row-${a.id}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold">{a.nama_penerima}
                      {a.is_default && <span className="ml-2 inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5"><Star className="w-3 h-3" /> Utama</span>}
                    </p>
                    <p className="text-sm text-slate-500">{a.telepon_penerima}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(a); setFormOpen(true); }} data-testid={`btn-edit-addr-${a.id}`}><Pencil className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(a.id)} data-testid={`btn-del-addr-${a.id}`}><Trash2 className="w-4 h-4 text-rose-600" /></Button>
                  </div>
                </div>
                <p className="text-sm text-slate-700 mt-2">{a.alamat_lengkap}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {[a.kelurahan, a.kecamatan, a.kabupaten, a.provinsi, a.kode_pos].filter(Boolean).join(", ")}
                </p>
                {a.patokan && <p className="text-xs text-slate-500 mt-1">Patokan: {a.patokan}</p>}
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-heading font-semibold text-lg mb-3">Preferensi Promosi</h2>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Terima informasi promosi</p>
              <p className="text-sm text-slate-500">Diskon, penawaran, dan info terbaru dari toko.</p>
            </div>
            <Switch checked={consent.status} onCheckedChange={saveConsent} data-testid="switch-promo-consent" />
          </div>
          {consent.status && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm font-medium mb-2">Saluran:</p>
              <div className="flex flex-wrap gap-4">
                {["whatsapp", "email", "sms"].map((ch) => (
                  <label key={ch} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={consent.saluran.includes(ch)} onCheckedChange={() => toggleSaluran(ch)} data-testid={`cb-saluran-${ch}`} />
                    <span className="capitalize">{ch}</span>
                  </label>
                ))}
              </div>
              <Button size="sm" className="mt-3" onClick={() => saveConsent(true)} data-testid="btn-save-saluran">Simpan Saluran</Button>
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
