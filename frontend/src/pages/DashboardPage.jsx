import { useEffect, useState } from "react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { formatRupiah } from "@/lib/format";
import { Smartphone, PackageCheck, TimerReset, Wallet, TrendingUp, Archive, Hammer } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

function StatCard({ icon: Icon, label, value, subtitle, testId, accent }) {
  return (
    <Card className="p-5 shadow-sm" data-testid={testId}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
          <p className="font-heading font-bold text-2xl mt-1 font-mono-tabular">{value}</p>
          {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
        </div>
        <div className={`w-9 h-9 rounded-md flex items-center justify-center ${accent || "bg-blue-50 text-[#0052FF]"}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.get("/dashboard/summary")
      .then((r) => setData(r.data))
      .catch((e) => setErr(formatApiErrorDetail(e?.response?.data?.detail) || e.message));
  }, []);

  const showFin = ["owner", "admin"].includes(user?.role);

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-slate-500">Ringkasan stok dan keuangan toko</p>
        </div>
        <Link to="/admin/inventaris/baru">
          <Button className="bg-[#0052FF] hover:bg-[#0040CC]" data-testid="btn-quick-add-unit">+ Tambah Unit</Button>
        </Link>
      </div>

      {err && <p className="text-rose-600 text-sm" data-testid="dashboard-error">{err}</p>}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <StatCard icon={Smartphone} label="Total Unit" value={data?.total_unit ?? "-"} testId="stat-total" />
        <StatCard icon={PackageCheck} label="Tersedia" value={data?.tersedia ?? "-"} testId="stat-tersedia" accent="bg-emerald-50 text-emerald-600" />
        <StatCard icon={TimerReset} label="Hold" value={data?.hold ?? "-"} testId="stat-hold" accent="bg-amber-50 text-amber-600" />
        <StatCard icon={Wallet} label="Terjual" value={data?.terjual ?? "-"} testId="stat-terjual" accent="bg-slate-100 text-slate-600" />
        <StatCard icon={Hammer} label="Servis" value={data?.servis ?? "-"} testId="stat-servis" accent="bg-rose-50 text-rose-600" />
        <StatCard icon={Archive} label="Arsip" value={data?.arsip ?? "-"} testId="stat-arsip" accent="bg-zinc-100 text-zinc-600" />
        {showFin && (
          <StatCard icon={Wallet} label="Nilai Modal Stok" value={formatRupiah(data?.nilai_modal_stok || 0)} testId="stat-modal" accent="bg-blue-50 text-[#0052FF]" />
        )}
        <StatCard icon={TrendingUp} label="Nilai Jual Stok" value={formatRupiah(data?.nilai_jual_stok || 0)} testId="stat-nilai-jual" accent="bg-emerald-50 text-emerald-600" />
        {showFin && (
          <StatCard icon={TrendingUp} label="Estimasi Laba Potensial" value={formatRupiah(data?.estimasi_laba_potensial || 0)} testId="stat-laba" accent="bg-blue-50 text-[#0052FF]" />
        )}
      </div>

      <Card className="p-6">
        <h2 className="font-heading text-lg font-semibold mb-3">Performa Merek (Terjual)</h2>
        {data?.performa_merek?.length ? (
          <ul className="divide-y">
            {data.performa_merek.map((m) => (
              <li key={m._id} className="flex items-center justify-between py-2">
                <span>{m._id || "(tidak diketahui)"}</span>
                <span className="font-mono-tabular text-sm text-slate-600">{m.count} unit</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">Belum ada data penjualan.</p>
        )}
      </Card>
    </div>
  );
}
