import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { api, formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";

const PROMO_VERSION = "v1.0";
const PROMO_TEXT = "Saya bersedia menerima informasi promosi, diskon, penawaran produk, program pembayaran, dan informasi terbaru dari toko melalui WhatsApp, email, atau saluran komunikasi lain yang saya pilih.";

export default function CustomerRegisterPage() {
  const nav = useNavigate();
  const { refreshMe } = useAuth();
  const [form, setForm] = useState({
    nama: "", email: "", telepon: "", password: "", konfirmasi_password: "",
    setujui_promosi: false, saluran_whatsapp: false, saluran_email: false, saluran_sms: false,
  });
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    if (form.password !== form.konfirmasi_password) {
      setErr("Konfirmasi kata sandi tidak sama");
      return;
    }
    if (form.password.length < 6) {
      setErr("Kata sandi minimal 6 karakter");
      return;
    }
    const saluran = [];
    if (form.setujui_promosi) {
      if (form.saluran_whatsapp) saluran.push("whatsapp");
      if (form.saluran_email) saluran.push("email");
      if (form.saluran_sms) saluran.push("sms");
    }
    setSaving(true);
    try {
      await api.post("/auth/register", {
        nama: form.nama, email: form.email, telepon: form.telepon,
        password: form.password, konfirmasi_password: form.konfirmasi_password,
        setujui_promosi: form.setujui_promosi,
        saluran_promosi: saluran,
        versi_persetujuan: PROMO_VERSION,
      });
      toast.success(`Selamat datang, ${form.nama}!`);
      await refreshMe();
      nav("/akun", { replace: true });
    } catch (e) {
      setErr(formatApiErrorDetail(e?.response?.data?.detail) || e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-5 py-10" data-testid="register-page">
      <Card className="p-8">
        <h1 className="font-heading font-bold text-2xl md:text-3xl">Daftar Pelanggan</h1>
        <p className="text-slate-500 text-sm mt-1">Buat akun untuk belanja dan menyimpan alamat pengiriman.</p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <Label htmlFor="nama">Nama lengkap</Label>
            <Input id="nama" required value={form.nama} onChange={(e) => setField("nama", e.target.value)} data-testid="reg-nama" />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required autoComplete="email" value={form.email} onChange={(e) => setField("email", e.target.value)} data-testid="reg-email" />
            </div>
            <div>
              <Label htmlFor="telepon">Nomor WhatsApp/telepon</Label>
              <Input id="telepon" required inputMode="tel" value={form.telepon} onChange={(e) => setField("telepon", e.target.value)} placeholder="08xx..." data-testid="reg-telepon" />
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="password">Kata sandi</Label>
              <Input id="password" type="password" required minLength={6} value={form.password} onChange={(e) => setField("password", e.target.value)} data-testid="reg-password" />
            </div>
            <div>
              <Label htmlFor="konfirmasi_password">Konfirmasi kata sandi</Label>
              <Input id="konfirmasi_password" type="password" required value={form.konfirmasi_password} onChange={(e) => setField("konfirmasi_password", e.target.value)} data-testid="reg-password2" />
            </div>
          </div>

          <div className="pt-4 border-t">
            <div className="flex items-start gap-2">
              <Checkbox id="setuju" checked={form.setujui_promosi} onCheckedChange={(v) => setField("setujui_promosi", !!v)} data-testid="reg-setuju-promo" className="mt-1" />
              <Label htmlFor="setuju" className="text-sm font-normal text-slate-700 leading-relaxed cursor-pointer">
                {PROMO_TEXT}
              </Label>
            </div>
            {form.setujui_promosi && (
              <div className="mt-3 ml-6 space-y-2">
                <p className="text-xs text-slate-500">Pilih saluran yang Anda setujui:</p>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={form.saluran_whatsapp} onCheckedChange={(v) => setField("saluran_whatsapp", !!v)} data-testid="reg-saluran-wa" /> WhatsApp
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={form.saluran_email} onCheckedChange={(v) => setField("saluran_email", !!v)} data-testid="reg-saluran-email" /> Email
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={form.saluran_sms} onCheckedChange={(v) => setField("saluran_sms", !!v)} data-testid="reg-saluran-sms" /> SMS
                  </label>
                </div>
              </div>
            )}
            <p className="text-[11px] text-slate-400 mt-3 inline-flex items-start gap-1">
              <ShieldCheck className="w-3 h-3 mt-0.5" />
              Persetujuan bersifat opsional dan dapat dicabut kapan saja melalui dashboard akun. Baca <Link to="/privasi" className="underline">Kebijakan Privasi</Link>.
            </p>
          </div>

          {err && <p className="text-rose-600 text-sm" data-testid="reg-error">{err}</p>}
          <Button type="submit" className="w-full bg-[#0052FF] hover:bg-[#0040CC]" disabled={saving} data-testid="btn-register-submit">
            {saving ? "Mendaftarkan..." : "Daftar Sekarang"}
          </Button>

          <p className="text-sm text-slate-500 text-center pt-2">
            Sudah punya akun? <Link to="/masuk" className="text-[#0052FF] hover:underline">Masuk di sini</Link>
          </p>
        </form>
      </Card>
    </div>
  );
}
