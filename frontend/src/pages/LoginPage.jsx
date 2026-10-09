import { useState } from "react";
import { useNavigate, useLocation, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { ShieldCheck, Store } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const redirectParam = params.get("redirect") || location.state?.from;

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const u = await login(email, password);
      toast.success(`Selamat datang, ${u.nama || u.email}`);
      // Routing berdasarkan role
      let dest;
      if (redirectParam) dest = redirectParam;
      else if (u.role === "pelanggan") dest = "/akun";
      else dest = "/admin";
      nav(dest, { replace: true });
    } catch (err) {
      setError(err.message || "Gagal masuk");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="hidden md:flex relative bg-slate-900 text-white p-10 overflow-hidden">
        <div className="absolute inset-0 opacity-30"
             style={{ backgroundImage: "radial-gradient(circle at 20% 20%, #0052FF 0%, transparent 40%), radial-gradient(circle at 80% 80%, #FF5722 0%, transparent 35%)" }} />
        <div className="relative z-10 flex flex-col justify-between w-full">
          <Link to="/" className="flex items-center gap-2 font-heading font-bold text-xl">
            <span className="w-8 h-8 rounded-md bg-[#0052FF] flex items-center justify-center text-sm">TH</span>
            Toko HP
          </Link>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/60 mb-3">Masuk</p>
            <h1 className="font-heading text-4xl font-bold leading-tight">
              Pelanggan belanja, <br />
              admin kelola toko — <br />
              <span className="text-[#FF5722]">satu akses.</span>
            </h1>
            <p className="mt-4 text-white/70 max-w-sm">
              Gunakan akun pelanggan untuk belanja atau akun staf untuk mengelola stok.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-white/60">
            <ShieldCheck className="w-4 h-4" /> Semua perhitungan diverifikasi di server
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 md:p-10">
        <Card className="w-full max-w-md p-8 shadow-sm">
          <h2 className="font-heading text-2xl font-bold tracking-tight">Masuk</h2>
          <p className="text-slate-500 text-sm mt-1">Pelanggan atau admin — gunakan email & kata sandi Anda.</p>

          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" required
                     value={email} onChange={(e) => setEmail(e.target.value)}
                     placeholder="email@contoh.id" data-testid="login-email" />
            </div>
            <div>
              <Label htmlFor="password">Kata Sandi</Label>
              <Input id="password" type="password" autoComplete="current-password" required
                     value={password} onChange={(e) => setPassword(e.target.value)}
                     placeholder="••••••••" data-testid="login-password" />
            </div>
            {error && <p className="text-sm text-rose-600" data-testid="login-error">{error}</p>}
            <Button type="submit" className="w-full bg-[#0052FF] hover:bg-[#0040CC]" disabled={loading} data-testid="btn-login-submit">
              {loading ? "Memproses..." : "Masuk"}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-200 flex items-center justify-between text-sm">
            <Link to="/" className="text-slate-500 hover:text-slate-900 inline-flex items-center gap-1.5" data-testid="link-storefront">
              <Store className="w-4 h-4" /> Lihat Toko
            </Link>
            <Link to="/daftar" className="text-[#0052FF] hover:underline" data-testid="link-daftar">
              Daftar sebagai pelanggan
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
