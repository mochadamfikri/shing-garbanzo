import { useEffect, useState, useMemo } from "react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatRupiah, formatTanggalID } from "@/lib/format";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from "recharts";
import {
  TrendingUp,
  Download,
  Wallet,
  Receipt,
  FileSpreadsheet,
  Calendar,
  Layers,
  Sparkles,
  ShoppingBag
} from "lucide-react";

export default function LaporanPage() {
  const today = new Date();
  const start30 = new Date(today);
  start30.setDate(start30.getDate() - 29);
  const toIso = (d) => d.toISOString().slice(0, 10);

  const [start, setStart] = useState(toIso(start30));
  const [end, setEnd] = useState(toIso(today));
  const [summary, setSummary] = useState(null);
  const [ts, setTs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const [resSummary, resTs] = await Promise.all([
        api.get("/reports/summary", { params: { start, end } }),
        api.get("/reports/timeseries", { params: { start, end } }),
      ]);
      setSummary(resSummary.data);
      setTs(resTs.data);
    } catch (e) {
      setErr(formatApiErrorDetail(e?.response?.data?.detail) || e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const quickRange = (days) => {
    const e = new Date();
    const s = new Date();
    s.setDate(s.getDate() - days + 1);
    setStart(toIso(s));
    setEnd(toIso(e));
  };

  const downloadExcel = (period) => {
    window.open(`${process.env.REACT_APP_BACKEND_URL || ""}/api/reports-v3/export-excel?period=${period}`, "_blank");
  };

  const chartData = useMemo(() => {
    if (!ts?.harian) return [];
    return ts.harian.map((r) => {
      const parts = r.tanggal.split("-");
      return {
        ...r,
        labelShort: `${parts[2]}/${parts[1]}`
      };
    });
  }, [ts]);

  return (
    <div className="space-y-5 pb-16 md:pb-6" data-testid="laporan-page">
      {/* Title & Excel Fast Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl tracking-tight text-slate-900 dark:text-white">
            Laporan Keuangan Toko
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Rekap omzet, HPP, laba bersih riil, dan ekspor lembar kerja Excel (.xlsx)
          </p>
        </div>

        {/* Quick Excel Downloads */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <Button
            size="sm"
            onClick={() => downloadExcel("daily")}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-9 shrink-0 shadow-sm"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" /> Unduh Harian (.xlsx)
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => downloadExcel("monthly")}
            className="font-semibold text-xs h-9 shrink-0 dark:border-slate-700"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-emerald-600" /> Unduh Bulanan
          </Button>
        </div>
      </div>

      {/* Date Filter Card (Mobile Friendly Touch Buttons) */}
      <Card className="p-4 border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {[
            { d: 1, label: "Hari Ini" },
            { d: 7, label: "7 Hari" },
            { d: 30, label: "30 Hari" },
            { d: 90, label: "3 Bulan" },
            { d: 365, label: "1 Tahun" }
          ].map((q) => (
            <button
              key={q.d}
              type="button"
              onClick={() => quickRange(q.d)}
              className="py-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
            >
              {q.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 items-end pt-1">
          <div>
            <Label className="text-[10px] uppercase font-bold text-slate-400">Tanggal Mulai</Label>
            <Input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="h-9 text-xs dark:bg-slate-800 dark:border-slate-700"
            />
          </div>
          <div>
            <Label className="text-[10px] uppercase font-bold text-slate-400">Tanggal Akhir</Label>
            <Input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="h-9 text-xs dark:bg-slate-800 dark:border-slate-700"
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Button
              onClick={load}
              className="w-full h-9 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs"
            >
              Terapkan Filter
            </Button>
          </div>
        </div>
      </Card>

      {err && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-700 dark:text-rose-300 rounded-xl text-xs">
          {err}
        </div>
      )}

      {/* Main KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Omzet */}
        <Card className="p-3.5 sm:p-4 border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">
              Total Omzet
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <p className="font-heading font-extrabold text-xl sm:text-2xl mt-1 text-slate-900 dark:text-white font-mono-tabular">
            {formatRupiah(summary?.omzet ?? 0)}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            {summary?.total_pesanan ?? 0} Transaksi Kasir
          </span>
        </Card>

        {/* HPP Modal */}
        <Card className="p-3.5 sm:p-4 border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">
              Modal Terjual (HPP)
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <p className="font-heading font-extrabold text-xl sm:text-2xl mt-1 text-slate-700 dark:text-slate-300 font-mono-tabular">
            {formatRupiah(summary?.hpp ?? 0)}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            Beban modal pokok unit
          </span>
        </Card>

        {/* Laba Bersih Riil */}
        <Card className="p-3.5 sm:p-4 border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">
              Laba Bersih Riil
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="font-heading font-extrabold text-xl sm:text-2xl mt-1 text-emerald-600 dark:text-emerald-400 font-mono-tabular">
            {formatRupiah(summary?.laba_bersih ?? 0)}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            Laba kotor: {formatRupiah(summary?.laba_kotor ?? 0)}
          </span>
        </Card>

        {/* Unit HP Terjual */}
        <Card className="p-3.5 sm:p-4 border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">
              Unit HP Terjual
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-600 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <p className="font-heading font-extrabold text-xl sm:text-2xl mt-1 text-purple-600 dark:text-purple-400 font-mono-tabular">
            {summary?.unit_terjual ?? 0} Unit
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            Fisik smartphone keluar
          </span>
        </Card>
      </div>

      {/* Financial Movement Chart (Interactive & Responsive on Mobile) */}
      <Card className="p-4 sm:p-5 border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-bold text-sm sm:text-base text-slate-900 dark:text-white">
            Grafik Pergerakan Omzet & Laba
          </h2>
          <span className="text-xs text-slate-400">Rentang Terpilih</span>
        </div>

        <div className="w-full h-64 sm:h-80 -ml-2 sm:ml-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="colOmzet" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colLaba" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
              <XAxis dataKey="labelShort" tick={{ fontSize: 10 }} stroke="#94a3b8" />
              <YAxis
                tick={{ fontSize: 10 }}
                tickFormatter={(v) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}jt` : v)}
                stroke="#94a3b8"
                width={45}
              />
              <Tooltip
                formatter={(v) => [formatRupiah(v), ""]}
                contentStyle={{
                  backgroundColor: "#0f172a",
                  borderColor: "#334155",
                  borderRadius: "0.75rem",
                  fontSize: "12px",
                  color: "#fff"
                }}
              />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
              <Area type="monotone" dataKey="omzet" name="Omzet Kasir" stroke="#2563eb" fill="url(#colOmzet)" strokeWidth={2} />
              <Area type="monotone" dataKey="laba_kotor" name="Laba Bersih" stroke="#10b981" fill="url(#colLaba)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Top Product Sold List */}
      <Card className="p-4 sm:p-5 border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-3">
        <h3 className="font-heading font-bold text-sm text-slate-900 dark:text-white">
          Perangkat Terlaris di Periode Ini
        </h3>
        {(!summary?.top_produk || summary.top_produk.length === 0) ? (
          <p className="text-xs text-slate-400 py-6 text-center">Belum ada transaksi di rentang tanggal ini.</p>
        ) : (
          <div className="space-y-2">
            {summary.top_produk.map((p, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center text-[10px]">
                    {idx + 1}
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{p.nama}</span>
                </div>
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60">
                  {p.count} Unit
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
