import { useEffect, useState } from "react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Trash2, Save } from "lucide-react";

export default function PengaturanPage() {
  const [s, setS] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => api.get("/settings").then((r) => setS(r.data)).catch(() => toast.error("Gagal memuat"));
  useEffect(() => { load(); }, []);

  const save = async (patch) => {
    setSaving(true);
    try {
      const { data } = await api.patch("/settings", patch);
      setS(data);
      toast.success("Pengaturan disimpan");
    } catch (e) {
      toast.error(formatApiErrorDetail(e?.response?.data?.detail) || "Gagal");
    } finally {
      setSaving(false);
    }
  };

  if (!s) return <div className="text-slate-500">Memuat...</div>;

  // Local draft states (persist di state 's' langsung + save button manual untuk toko/pembayaran)
  const updatePembayaran = (idx, patch) => {
    const next = [...s.pembayaran];
    next[idx] = { ...next[idx], ...patch };
    setS({ ...s, pembayaran: next });
  };
  const addRekening = (idx) => {
    updatePembayaran(idx, { rekening: [...(s.pembayaran[idx].rekening || []), { bank: "", nomor: "", atas_nama: "" }] });
  };
  const updateRekening = (idx, ri, patch) => {
    const rek = [...(s.pembayaran[idx].rekening || [])];
    rek[ri] = { ...rek[ri], ...patch };
    updatePembayaran(idx, { rekening: rek });
  };
  const removeRekening = (idx, ri) => {
    const rek = (s.pembayaran[idx].rekening || []).filter((_, i) => i !== ri);
    updatePembayaran(idx, { rekening: rek });
  };

  const updatePengiriman = (idx, patch) => {
    const next = [...s.pengiriman];
    next[idx] = { ...next[idx], ...patch };
    setS({ ...s, pengiriman: next });
  };

  return (
    <div className="space-y-5" data-testid="settings-page">
      <div>
        <h1 className="font-heading font-bold text-3xl">Pengaturan Toko</h1>
        <p className="text-slate-500">Identitas, pembayaran, dan pengiriman.</p>
      </div>

      <Tabs defaultValue="toko">
        <TabsList>
          <TabsTrigger value="toko" data-testid="tab-toko">Identitas Toko</TabsTrigger>
          <TabsTrigger value="pembayaran" data-testid="tab-pembayaran">Pembayaran</TabsTrigger>
          <TabsTrigger value="pengiriman" data-testid="tab-pengiriman">Pengiriman</TabsTrigger>
        </TabsList>

        <TabsContent value="toko">
          <Card className="p-5 mt-4 space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div><Label>Nama toko</Label><Input value={s.nama_toko || ""} onChange={(e) => setS({ ...s, nama_toko: e.target.value })} data-testid="s-nama-toko" /></div>
              <div><Label>Nomor WhatsApp (format: 628xxx)</Label><Input value={s.whatsapp_number || ""} onChange={(e) => setS({ ...s, whatsapp_number: e.target.value })} data-testid="s-wa-number" /></div>
              <div><Label>Email toko</Label><Input value={s.email_toko || ""} onChange={(e) => setS({ ...s, email_toko: e.target.value })} data-testid="s-email" /></div>
              <div><Label>Logo URL</Label><Input value={s.logo_url || ""} onChange={(e) => setS({ ...s, logo_url: e.target.value })} /></div>
            </div>
            <div><Label>Alamat toko</Label><Textarea rows={2} value={s.alamat_toko || ""} onChange={(e) => setS({ ...s, alamat_toko: e.target.value })} /></div>
            <div><Label>Pesan default WhatsApp</Label><Input value={s.whatsapp_pesan_default || ""} onChange={(e) => setS({ ...s, whatsapp_pesan_default: e.target.value })} /></div>
            <div className="flex justify-end">
              <Button onClick={() => save({
                nama_toko: s.nama_toko, whatsapp_number: s.whatsapp_number, email_toko: s.email_toko,
                alamat_toko: s.alamat_toko, logo_url: s.logo_url, whatsapp_pesan_default: s.whatsapp_pesan_default,
              })} disabled={saving} data-testid="btn-save-toko">
                <Save className="w-4 h-4 mr-1.5" /> Simpan
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="pembayaran">
          <div className="space-y-3 mt-4">
            {s.pembayaran.map((p, idx) => (
              <Card key={p.kode} className="p-5" data-testid={`pay-config-${p.kode}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-heading font-semibold text-lg">{p.nama}</p>
                    <p className="text-xs text-slate-500">Kode: {p.kode}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm">Aktif</Label>
                    <Switch checked={!!p.aktif} onCheckedChange={(v) => updatePembayaran(idx, { aktif: v })} data-testid={`switch-pay-${p.kode}`} />
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-3 mt-3">
                  <div><Label>Deskripsi singkat</Label><Input value={p.deskripsi || ""} onChange={(e) => updatePembayaran(idx, { deskripsi: e.target.value })} /></div>
                  <div><Label>Prioritas</Label><Input type="number" value={p.prioritas || 1} onChange={(e) => updatePembayaran(idx, { prioritas: parseInt(e.target.value || "1") })} /></div>
                </div>
                <div className="mt-3"><Label>Petunjuk pembayaran</Label><Textarea rows={2} value={p.petunjuk || ""} onChange={(e) => updatePembayaran(idx, { petunjuk: e.target.value })} /></div>
                {p.kode === "transfer_bank" && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <Label>Rekening Toko</Label>
                      <Button size="sm" variant="outline" onClick={() => addRekening(idx)} data-testid={`btn-add-rek-${p.kode}`}><Plus className="w-3 h-3 mr-1" /> Tambah</Button>
                    </div>
                    <div className="space-y-2">
                      {(p.rekening || []).map((r, ri) => (
                        <div key={ri} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-center">
                          <Input placeholder="Bank" value={r.bank} onChange={(e) => updateRekening(idx, ri, { bank: e.target.value })} />
                          <Input placeholder="Nomor rekening" value={r.nomor} onChange={(e) => updateRekening(idx, ri, { nomor: e.target.value })} className="font-mono-tabular" />
                          <Input placeholder="Atas nama" value={r.atas_nama} onChange={(e) => updateRekening(idx, ri, { atas_nama: e.target.value })} />
                          <Button size="icon" variant="ghost" onClick={() => removeRekening(idx, ri)}><Trash2 className="w-4 h-4 text-rose-600" /></Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {p.kode === "qris_merchant" && (
                  <div className="mt-3"><Label>URL gambar QR</Label><Input value={p.qr_image_url || ""} onChange={(e) => updatePembayaran(idx, { qr_image_url: e.target.value })} /></div>
                )}
              </Card>
            ))}
            <div className="flex justify-end">
              <Button onClick={() => save({ pembayaran: s.pembayaran })} disabled={saving} data-testid="btn-save-pembayaran">
                <Save className="w-4 h-4 mr-1.5" /> Simpan Pengaturan Pembayaran
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="pengiriman">
          <div className="space-y-3 mt-4">
            {s.pengiriman.map((p, idx) => (
              <Card key={p.kode} className="p-5" data-testid={`ship-config-${p.kode}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-heading font-semibold text-lg">{p.nama}</p>
                    <p className="text-xs text-slate-500">Kode: {p.kode}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm">Aktif</Label>
                    <Switch checked={!!p.aktif} onCheckedChange={(v) => updatePengiriman(idx, { aktif: v })} data-testid={`switch-ship-${p.kode}`} />
                  </div>
                </div>
                <div className="grid md:grid-cols-3 gap-3 mt-3">
                  <div><Label>Default biaya (Rp)</Label><Input type="number" value={p.default_biaya || 0} onChange={(e) => updatePengiriman(idx, { default_biaya: parseFloat(e.target.value || "0") })} /></div>
                  <div className="flex items-end gap-2">
                    <div className="flex items-center gap-2">
                      <Switch checked={!!p.butuh_konfirmasi} onCheckedChange={(v) => updatePengiriman(idx, { butuh_konfirmasi: v })} />
                      <Label className="text-sm">Butuh konfirmasi ongkir</Label>
                    </div>
                  </div>
                  <div><Label>Prioritas</Label><Input type="number" value={p.prioritas || 1} onChange={(e) => updatePengiriman(idx, { prioritas: parseInt(e.target.value || "1") })} /></div>
                </div>
                <div className="mt-3"><Label>Deskripsi</Label><Input value={p.deskripsi || ""} onChange={(e) => updatePengiriman(idx, { deskripsi: e.target.value })} /></div>
              </Card>
            ))}
            <div className="flex justify-end">
              <Button onClick={() => save({ pengiriman: s.pengiriman })} disabled={saving} data-testid="btn-save-pengiriman">
                <Save className="w-4 h-4 mr-1.5" /> Simpan Pengaturan Pengiriman
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
