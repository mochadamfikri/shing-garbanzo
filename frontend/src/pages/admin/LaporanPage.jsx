import { useEffect, useState, useMemo } from "react";
import { api, API_BASE, formatApiErrorDetail } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatRupiah, formatTanggalID } from "@/lib/format";
import { toast } from "sonner";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ComposedChart, Cell,
} from "recharts";
import { TrendingUp, TrendingDown, Package, Download, Wallet, Receipt } from "lucide-react";

function KpiCard({ label, value, icon: Icon, accent, subtitle, testId }) {
  return (
    <Card className="p-5" data-testid={testId}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
          <p className="font-heading font-bold text-xl md:text-2xl mt-1 font-mono-tabular">{value}</p>
          {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
        </div>
        <div className={`w-9 h-9 rounded-md flex items-center justify-center ${accent || "bg-blue-50 text-[#0052FF]"}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </Card>
  );
}

function formatDayShort(dateStr) {
  try {
    const d = new Date(dateStr);
    return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`;
  } catch { return dateStr; }
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-md shadow-md p-2 text-xs">
      <p className="font-medium">{formatTanggalID(label)}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: <span className="font-mono-tabular">{formatRupiah(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

function OhlcChart({ data }) {
  if (!data?.length) return <p className="text-center text-sm text-slate-500 py-10">Belum ada data mingguan.</p>;
  const chartData = data.map((d) => {
    const up = d.close >= d.open;
    return { ...d, color: up ? "#10b981" : "#ef4444", bodyMin: Math.min(d.open, d.close), bodyMax: Math.max(d.open, d.close), bodyRange: [Math.min(d.open, d.close), Math.max(d.open, d.close)], wick: [d.low, d.high] };
  });
  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => "Rp " + (v / 1_000_000).toFixed(0) + "jt"} />
        <Tooltip
          formatter={(v, k) => [formatRupiah(v), k]}
          labelFormatter={(l) => `Minggu ${l}`}
        />
        {/* wick: low–high */}
        <Bar dataKey="wick" fill="#64748b" barSize={2} isAnimationActive={false} />
        {/* body: open–close */}
        <Bar dataKey="bodyRange" barSize={12} isAnimationActive={false}>
          {chartData.map((d, i) => <Cell key={i} fill={d.color} />)}
        </Bar>
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export default function LaporanPage() {
  const today = new Date();
  const start30 = new Date(today); start30.setDate(start30.getDate() - 29);
  const toIso = (d) => d.toISOString().slice(0, 10);

  const [start, setStart] = useState(toIso(start30));
  const [end, setEnd] = useState(toIso(today));
  const [summary, setSummary] = useState(null);
  const [ts, setTs] = useState(null);
  const [invValue, setInvValue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = async () => {
    setLoading(true); setErr("");
    try {
      const [a, b, c] = await Promise.all([
        api.get("/reports/summary", { params: { start, end } }),
        api.get("/reports/timeseries", { params: { start, end } }),
        api.get("/reports/inventory-value"),
      ]);
      setSummary(a.data); setTs(b.data); setInvValue(c.data);
    } catch (e) {
      setErr(formatApiErrorDetail(e?.response?.data?.detail) || e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const quickRange = (days) => {
    const e = new Date(); const s = new Date(); s.setDate(s.getDate() - days + 1);
    setStart(toIso(s)); setEnd(toIso(e));
  };

  const exportCsv = (jenis) => {
    const url = `${API_BASE}/api/reports/export?jenis=${jenis}&start=${start}&end=${end}`;
    window.open(url, "_blank");
    toast.info(`Mengunduh ${jenis}.csv`);
  };

  const chartData = useMemo(() => {
    if (!ts?.harian) return [];
    return ts.harian.map((r) => ({ ...r, labelShort: formatDayShort(r.tanggal) }));
  }, [ts]);

  return (
    <div className="space-y-5" data-testid="laporan-page">
      <div>
        <h1 className="font-heading font-bold text-3xl">Laporan Keuangan</h1>
        <p className="text-slate-500">Omzet, HPP, laba, pengeluaran, dan grafik pergerakan.</p>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
          <div><Label>Mulai</Label><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} data-testid="lap-start" /></div>
          <div><Label>Akhir</Label><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} data-testid="lap-end" /></div>
          <div className="md:col-span-3 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => quickRange(1)} data-testid="lap-range-today">Hari Ini</Button>
            <Button size="sm" variant="outline" onClick={() => quickRange(7)} data-testid="lap-range-7">7 Hari</Button>
            <Button size="sm" variant="outline" onClick={() => quickRange(30)} data-testid="lap-range-30">30 Hari</Button>
            <Button size="sm" variant="outline" onClick={() => quickRange(90)} data-testid="lap-range-90">90 Hari</Button>
            <Button size="sm" variant="outline" onClick={() => quickRange(365)} data-testid="lap-range-365">1 Tahun</Button>
          </div>
          <Button onClick={load} className="bg-[#0052FF] hover:bg-[#0040CC]" data-testid="btn-apply-range">Terapkan</Button>
        </div>
      </Card>

      {err && <p className="text-rose-600 text-sm">{err}</p>}
      {loading && <p className="text-slate-500">Memuat...</p>}

      {summary && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiCard label="Omzet" value={formatRupiah(summary.omzet)} icon={TrendingUp} accent="bg-emerald-50 text-emerald-600" testId="kpi-omzet" subtitle={`${summary.total_pesanan} pesanan`} />
            <KpiCard label="HPP" value={formatRupiah(summary.hpp)} icon={Package} accent="bg-amber-50 text-amber-600" testId="kpi-hpp" />
            <KpiCard label="Laba Kotor" value={formatRupiah(summary.laba_kotor)} icon={TrendingUp} accent="bg-blue-50 text-[#0052FF]" testId="kpi-laba-kotor" />
            <KpiCard label="Pengeluaran" value={formatRupiah(summary.pengeluaran)} icon={Receipt} accent="bg-rose-50 text-rose-600" testId="kpi-pengeluaran" />
            <KpiCard label="Laba Bersih" value={formatRupiah(summary.laba_bersih)} icon={summary.profit_loss === "PROFIT" ? TrendingUp : TrendingDown} accent={summary.profit_loss === "PROFIT" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"} testId="kpi-laba-bersih" subtitle={summary.profit_loss} />
            <KpiCard label="Unit Terjual" value={summary.unit_terjual} icon={Package} testId="kpi-unit" />
          </div>

          <Tabs defaultValue="pergerakan">
            <TabsList>
              <TabsTrigger value="pergerakan" data-testid="tab-pergerakan">Pergerakan Keuangan</TabsTrigger>
              <TabsTrigger value="penjualan" data-testid="tab-penjualan">Tingkat Penjualan</TabsTrigger>
              <TabsTrigger value="ohlc" data-testid="tab-ohlc">Candle Mingguan (OHLC)</TabsTrigger>
              <TabsTrigger value="rincian" data-testid="tab-rincian">Rincian</TabsTrigger>
            </TabsList>

            <TabsContent value="pergerakan">
              <Card className="p-5 mt-4">
                <h2 className="font-heading font-semibold mb-3">Grafik Pergerakan Keuangan Harian</h2>
                <ResponsiveContainer width="100%" height={320}>
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="colOmzet" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.6} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colLaba" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0052FF" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="#0052FF" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="labelShort" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => "Rp " + (v / 1_000_000).toFixed(0) + "jt"} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Area type="monotone" dataKey="omzet" name="Omzet" stroke="#10b981" fill="url(#colOmzet)" strokeWidth={2} />
                    <Area type="monotone" dataKey="laba_kotor" name="Laba Kotor" stroke="#0052FF" fill="url(#colLaba)" strokeWidth={2} />
                    <Line type="monotone" dataKey="pengeluaran" name="Pengeluaran" stroke="#ef4444" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="laba_bersih" name="Laba Bersih" stroke="#f59e0b" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>
            </TabsContent>

            <TabsContent value="penjualan">
              <Card className="p-5 mt-4">
                <h2 className="font-heading font-semibold mb-3">Tingkat Penjualan Harian</h2>
                <ResponsiveContainer width="100%" height={320}>
                  <ComposedChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="labelShort" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => "Rp " + (v / 1_000_000).toFixed(0) + "jt"} />
                    <Tooltip formatter={(v, k) => k === "Unit Terjual" || k === "Pesanan" ? [v, k] : [formatRupiah(v), k]} labelFormatter={formatTanggalID} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar yAxisId="left" dataKey="unit_terjual" name="Unit Terjual" fill="#0052FF" />
                    <Bar yAxisId="left" dataKey="pesanan" name="Pesanan" fill="#8b5cf6" />
                    <Line yAxisId="right" type="monotone" dataKey="omzet" name="Omzet" stroke="#10b981" strokeWidth={2} />
                  </ComposedChart>
                </ResponsiveContainer>
              </Card>
            </TabsContent>

            <TabsContent value="ohlc">
              <Card className="p-5 mt-4">
                <h2 className="font-heading font-semibold mb-1">Candle Mingguan Omzet (OHLC)</h2>
                <p className="text-xs text-slate-500 mb-3">Open/High/Low/Close dari omzet harian per minggu. Hijau = minggu naik.</p>
                <OhlcChart data={ts?.mingguan_ohlc} />
              </Card>
            </TabsContent>

            <TabsContent value="rincian">
              <div className="grid md:grid-cols-2 gap-4 mt-4">
                <Card className="p-5">
                  <h2 className="font-heading font-semibold mb-3">Top Produk Periode</h2>
                  {summary.top_produk?.length ? (
                    <ul className="divide-y">
                      {summary.top_produk.map((p) => (
                        <li key={p.produk} className="flex justify-between py-2 text-sm">
                          <span>{p.produk}</span>
                          <span className="font-mono-tabular font-medium">{p.unit} unit</span>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-sm text-slate-500">Belum ada penjualan di rentang ini.</p>}
                </Card>
                <Card className="p-5">
                  <h2 className="font-heading font-semibold mb-3">Pengeluaran per Kategori</h2>
                  {summary.pengeluaran_per_kategori?.length ? (
                    <ul className="divide-y">
                      {summary.pengeluaran_per_kategori.map((p) => (
                        <li key={p.kategori} className="flex justify-between py-2 text-sm">
                          <span>{p.kategori}</span>
                          <span className="font-mono-tabular font-medium">{formatRupiah(p.nominal)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-sm text-slate-500">Belum ada pengeluaran di rentang ini.</p>}
                </Card>
                {invValue && (
                  <Card className="p-5 md:col-span-2">
                    <h2 className="font-heading font-semibold mb-3">Nilai Inventaris Saat Ini</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div><p className="text-xs text-slate-500 uppercase tracking-wide">Total Unit</p><p className="font-mono-tabular font-semibold text-lg">{invValue.total_unit}</p></div>
                      <div><p className="text-xs text-slate-500 uppercase tracking-wide">Modal Stok</p><p className="font-mono-tabular font-semibold text-lg">{formatRupiah(invValue.total_modal)}</p></div>
                      <div><p className="text-xs text-slate-500 uppercase tracking-wide">Nilai Jual Stok</p><p className="font-mono-tabular font-semibold text-lg">{formatRupiah(invValue.total_nilai_jual)}</p></div>
                      <div><p className="text-xs text-slate-500 uppercase tracking-wide">Potensi Laba</p><p className="font-mono-tabular font-semibold text-lg text-emerald-600">{formatRupiah(invValue.estimasi_laba_potensial)}</p></div>
                    </div>
                  </Card>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <Card className="p-5">
            <h2 className="font-heading font-semibold mb-3">Export</h2>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => exportCsv("keuangan")} data-testid="btn-export-keuangan">
                <Download className="w-4 h-4 mr-1.5" /> Keuangan Harian (CSV)
              </Button>
              <Button variant="outline" onClick={() => exportCsv("penjualan")} data-testid="btn-export-penjualan">
                <Download className="w-4 h-4 mr-1.5" /> Penjualan Per Pesanan (CSV)
              </Button>
              <Button variant="outline" onClick={() => exportCsv("pengeluaran")} data-testid="btn-export-pengeluaran">
                <Download className="w-4 h-4 mr-1.5" /> Pengeluaran (CSV)
              </Button>
            </div>
            <p className="text-xs text-slate-500 mt-2">CSV dapat dibuka di Excel/Google Sheets.</p>
          </Card>
        </>
      )}
    </div>
  );
}
