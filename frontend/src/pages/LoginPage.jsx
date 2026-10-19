import { useState } from "react";
import { useNavigate, useLocation, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import {useSettings} from "@/lib/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { ShieldCheck, Store } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const { settings } = useSettings();
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
      nav("/admin", { replace: true });
    } catch (err) {
      setError(err.message || "Gagal masuk");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 transition-colors">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center px-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center text-lg font-bold shadow-md shadow-blue-500/30 mx-auto mb-3">
          SG
        </div>
        <h1 className="font-heading text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Sadam Gadget
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          Admin & Management Suite Login
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <Card className="p-6 sm:p-8 shadow-sm border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl">
          <form className="space-y-4" onSubmit={onSubmit}>
            <div>
              <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Email Admin
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@sadamgadget.com"
                className="mt-1 text-sm dark:bg-slate-800 dark:border-slate-700 h-10"
                data-testid="login-email"
              />
            </div>
            <div>
              <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Kata Sandi
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1 text-sm dark:bg-slate-800 dark:border-slate-700 h-10"
                data-testid="login-password"
              />
            </div>

            {error && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 rounded-xl text-xs">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-500/20 rounded-xl mt-2"
              disabled={loading}
              data-testid="btn-login-submit"
            >
              {loading ? "Memverifikasi..." : "Masuk ke Panel Admin"}
            </Button>
          </form>

          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
            <span className="text-[11px] text-slate-400 flex items-center justify-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-500" /> Akses Terotentikasi & Terisolasi
            </span>
          </div>
        </Card>
      </div>
    </div>
  );
}
