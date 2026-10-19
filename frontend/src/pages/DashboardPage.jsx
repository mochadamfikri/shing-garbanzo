import { useEffect, useState, useMemo } from "react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { formatRupiah } from "@/lib/format";
import {
  Smartphone,
  PackageCheck,
  TimerReset,
  Wallet,
  TrendingUp,
  Archive,
  Hammer,
  ArrowRight,
  TrendingDown,
  ChevronRight,
  Calendar,
  Layers,
  Sparkles,
  ScanLine
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import DetailModal from "@/components/DetailModal";
import { Download, FileSpreadsheet, CalendarDays } from "lucide-react";

function ClickableStatCard({ icon: Icon, label, value, subtitle, testId, colorClass, onClick }) {
  return (
    <Card
      onClick={onClick}
      className="p-4 sm:p-5 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 group relative overflow-hidden"
      data-testid={testId}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {label}
          </p>
          <p className="font-heading font-extrabold text-2xl sm:text-3xl font-mono-tabular text-slate-900 dark:text-white">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {subtitle}
            </p>
          )}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${colorClass}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="mt-3 flex items-center text-[11px] font-semibold text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
        Lihat Detail <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Modal State
  const [activeModal, setActiveModal] = useState(null); // 'tersedia', 'hold', 'terjual', 'servis', 'modal', 'omzet', 'brand'
  const [reportModalPeriod, setReportModalPeriod] = useState(null); // 'daily', 'weekly', 'monthly'
  const [reportData, setReportData] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);

  const openReport = async (p) => {
    setReportModalPeriod(p);
    setLoadingReport(true);
    try {
      const res = await api.get(`/reports-v3/period?period=${p}`);
      setReportData(res.data);
    } catch (e) {
      // fallback
    } finally {
      setLoadingReport(false);
    }
  };

  const downloadExcel = (p) => {
    window.open(`${process.env.REACT_APP_BACKEND_URL || ""}/api/reports-v3/export-excel?period=${p}`, "_blank");
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get("/dashboard/summary"),
      api.get("/inventory"),
      api.get("/pos/sales")
    ])
      .then(([resSummary, resInv, resSales]) => {
        setData(resSummary.data);
        setInventory(resInv.data);
        setSales(resSales.data);
      })
      .catch((e) => setErr(formatApiErrorDetail(e?.response?.data?.detail) || e.message))
      .finally(() => setLoading(false));
  }, []);

  const showFin = ["owner", "admin"].includes(user?.role);

  // Filtered lists for modals
  const unitTersedia = useMemo(() => inventory.filter((u) => u.status_stok === "TERSEDIA"), [inventory]);
  const unitHold = useMemo(() => inventory.filter((u) => u.status_stok === "HOLD"), [inventory]);
  const unitTerjual = useMemo(() => inventory.filter((u) => u.status_stok === "TERJUAL"), [inventory]);
  const unitServis = useMemo(() => inventory.filter((u) => u.status_stok === "SERVIS"), [inventory]);

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      {/* Page Title & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            Dashboard Utama
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Pantau stok inventaris HP, perputaran kasir POS, dan kinerja laba toko
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/admin/penjualan">
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm shadow-blue-500/20 text-xs">
              <ScanLine className="w-4 h-4 mr-1.5" /> Buka Kasir / POS
            </Button>
          </Link>
          <Link to="/admin/inventaris/baru">
            <Button size="sm" variant="outline" className="font-semibold text-xs dark:border-slate-700 dark:text-slate-200">
              + Tambah Unit
            </Button>
          </Link>
        </div>
      </div>

      {err && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 rounded-xl text-sm">
          {err}
        </div>
      )}

      {/* Stock Overview Cards (Clickable to Floating Modal) */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5 text-blue-500" /> Rekap Penjualan & Laporan Berkala (Klik Kartu untuk Buka Modal / Unduh Excel)
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
          <Card
            onClick={() => openReport("daily")}
            className="p-4 sm:p-5 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 group"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                  Daily Report
                </span>
                <p className="font-heading font-extrabold text-lg mt-2 text-slate-900 dark:text-white">
                  Laporan Hari Ini
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Rekap kasir & unit terjual harian
                </p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center">
              Buka Detail & Excel <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </div>
          </Card>

          <Card
            onClick={() => openReport("weekly")}
            className="p-4 sm:p-5 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 group"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                  Weekly Report
                </span>
                <p className="font-heading font-extrabold text-lg mt-2 text-slate-900 dark:text-white">
                  Laporan 7 Hari Terakhir
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Tren omzet & laba mingguan
                </p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center">
              Buka Detail & Excel <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </div>
          </Card>

          <Card
            onClick={() => openReport("monthly")}
            className="p-4 sm:p-5 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 group"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                  Monthly Report
                </span>
                <p className="font-heading font-extrabold text-lg mt-2 text-slate-900 dark:text-white">
                  Laporan Bulan Berjalan
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Akumulasi bulanan & profit bersih
                </p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center">
              Buka Detail & Excel <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </div>
          </Card>
        </div>

        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" /> Ringkasan Unit Fisik (Klik kartu untuk detail)
          </h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <ClickableStatCard
            icon={Smartphone}
            label="Total Tersedia"
            value={data?.tersedia ?? "-"}
            subtitle="Siap dijual di kasir"
            testId="stat-tersedia"
            colorClass="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400"
            onClick={() => setActiveModal("tersedia")}
          />
          <ClickableStatCard
            icon={TimerReset}
            label="Booking / Hold"
            value={data?.hold ?? "-"}
            subtitle="Unit dalam pesanan"
            testId="stat-hold"
            colorClass="bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400"
            onClick={() => setActiveModal("hold")}
          />
          <ClickableStatCard
            icon={PackageCheck}
            label="Total Terjual"
            value={data?.terjual ?? "-"}
            subtitle="Rekap kasir POS"
            testId="stat-terjual"
            colorClass="bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400"
            onClick={() => setActiveModal("terjual")}
          />
          <ClickableStatCard
            icon={Hammer}
            label="Unit Servis"
            value={data?.servis ?? "-"}
            subtitle="Perbaikan teknisi"
            testId="stat-servis"
            colorClass="bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400"
            onClick={() => setActiveModal("servis")}
          />
        </div>
      </div>

      {/* Finance Metrics (Owner & Admin Only) */}
      {showFin && (
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Metrik Nilai & Keuangan
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <ClickableStatCard
              icon={Wallet}
              label="Modal Stok Aktif"
              value={formatRupiah(data?.nilai_modal_stok ?? 0)}
              subtitle="Nilai beli unit tersedia"
              testId="stat-modal"
              colorClass="bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400"
              onClick={() => setActiveModal("modal")}
            />
            <ClickableStatCard
              icon={TrendingUp}
              label="Estimasi Nilai Jual"
              value={formatRupiah(data?.nilai_jual_stok ?? 0)}
              subtitle="Potensi perputaran kas"
              testId="stat-nilai-jual"
              colorClass="bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400"
              onClick={() => setActiveModal("modal")}
            />
            <ClickableStatCard
              icon={TrendingUp}
              label="Potensi Laba Kotor"
              value={formatRupiah(data?.estimasi_laba_potensial ?? 0)}
              subtitle="Margin keuntungan stok"
              testId="stat-laba-potensial"
              colorClass="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400"
              onClick={() => setActiveModal("modal")}
            />
          </div>
        </div>
      )}

      {/* Brand Distribution & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Brand Inventory */}
        <Card className="p-4 sm:p-5 border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-bold text-base text-slate-900 dark:text-white">
              Sebaran Unit per Brand
            </h3>
            <span className="text-xs text-slate-400">{data?.performa_merek?.length || 0} Merk Terdaftar</span>
          </div>
          {(!data?.performa_merek || data.performa_merek.length === 0) ? (
            <p className="text-xs text-slate-400 py-6 text-center">Belum ada unit inventaris terdaftar</p>
          ) : (
            <div className="space-y-2.5">
              {data.performa_merek.map((m) => (
                <div key={m._id} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                  <span className="font-semibold text-xs sm:text-sm text-slate-800 dark:text-slate-200">{m._id || "Tanpa Merek"}</span>
                  <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                    {m.count} unit
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent POS Sales Activity */}
        <Card className="p-4 sm:p-5 border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-bold text-base text-slate-900 dark:text-white">
              Transaksi Terakhir Kasir
            </h3>
            <Link to="/admin/laporan" className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline">
              Lihat Laporan
            </Link>
          </div>
          {sales.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">Belum ada transaksi penjualan</p>
          ) : (
            <div className="space-y-2.5">
              {sales.slice(0, 5).map((s) => (
                <div key={s.id} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <div className="space-y-0.5">
                    <p className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">{s.nomor_transaksi}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {s.items?.length || 0} unit · {s.metode_pembayaran}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-heading font-bold text-xs sm:text-sm text-emerald-600 dark:text-emerald-400">
                      {formatRupiah(s.penjualan_bersih)}
                    </p>
                    <p className="text-[10px] text-slate-400">Selesai</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Floating Modals for Detailed Breakdown */}
      {/* 1. Modal Unit Tersedia */}
      <DetailModal
        isOpen={activeModal === "tersedia"}
        onClose={() => setActiveModal(null)}
        title="Daftar Unit Tersedia (Siap Dijual)"
        subtitle={`Total ${unitTersedia.length} unit berstatus TERSEDIA di sistem`}
      >
        {unitTersedia.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">Tidak ada unit yang berstatus tersedia.</p>
        ) : (
          <div className="space-y-2">
            {unitTersedia.map((u) => (
              <div key={u.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <div>
                  <p className="font-semibold text-sm text-slate-900 dark:text-white">{u.merek} {u.model}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">IMEI: {u.imei_1}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm text-blue-600 dark:text-blue-400 font-mono-tabular">{formatRupiah(u.harga_jual)}</p>
                  <span className="text-[10px] font-semibold text-emerald-600 uppercase bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                    {u.kondisi}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </DetailModal>

      {/* 2. Modal Unit Terjual */}
      <DetailModal
        isOpen={activeModal === "terjual"}
        onClose={() => setActiveModal(null)}
        title="Daftar Unit Terjual (POS)"
        subtitle={`Total ${unitTerjual.length} unit tercatat TERJUAL melalui sistem kasir`}
      >
        {unitTerjual.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">Belum ada unit yang terjual.</p>
        ) : (
          <div className="space-y-2">
            {unitTerjual.map((u) => (
              <div key={u.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <div>
                  <p className="font-semibold text-sm text-slate-900 dark:text-white">{u.merek} {u.model}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">IMEI: {u.imei_1}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm text-emerald-600 dark:text-emerald-400 font-mono-tabular">{formatRupiah(u.harga_jual)}</p>
                  <span className="text-[10px] font-semibold text-slate-500 uppercase bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                    TERJUAL
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </DetailModal>

      {/* 3. Modal Unit Hold / Booking */}
      <DetailModal
        isOpen={activeModal === "hold"}
        onClose={() => setActiveModal(null)}
        title="Daftar Unit Hold / Booking"
        subtitle={`Total ${unitHold.length} unit berstatus ditahan sementara`}
      >
        {unitHold.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">Tidak ada unit yang sedang di-hold.</p>
        ) : (
          <div className="space-y-2">
            {unitHold.map((u) => (
              <div key={u.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <div>
                  <p className="font-semibold text-sm text-slate-900 dark:text-white">{u.merek} {u.model}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">IMEI: {u.imei_1}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm text-amber-600 dark:text-amber-400 font-mono-tabular">{formatRupiah(u.harga_jual)}</p>
                  <span className="text-[10px] font-semibold text-amber-600 uppercase bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-full">
                    HOLD
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </DetailModal>

      {/* 4. Modal Unit Servis */}
      <DetailModal
        isOpen={activeModal === "servis"}
        onClose={() => setActiveModal(null)}
        title="Daftar Unit Servis / Reparasi"
        subtitle={`Total ${unitServis.length} unit dalam proses teknisi`}
      >
        {unitServis.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">Tidak ada unit dalam status servis.</p>
        ) : (
          <div className="space-y-2">
            {unitServis.map((u) => (
              <div key={u.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <div>
                  <p className="font-semibold text-sm text-slate-900 dark:text-white">{u.merek} {u.model}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">IMEI: {u.imei_1}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-semibold text-purple-600 uppercase bg-purple-50 dark:bg-purple-950/60 px-2 py-0.5 rounded-full">
                    SERVIS
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </DetailModal>

      {/* 5. Modal Rincian Keuangan Stok */}
      <DetailModal
        isOpen={activeModal === "modal"}
        onClose={() => setActiveModal(null)}
        title="Rincian Nilai & Modal Stok"
        subtitle="Analisis perputaran modal dan estimasi margin kotor unit tersedia"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Total Modal Tertanam</p>
              <p className="text-lg font-bold font-mono text-slate-900 dark:text-white">{formatRupiah(data?.nilai_modal_stok ?? 0)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Estimasi Omzet Potensial</p>
              <p className="text-lg font-bold font-mono text-blue-600 dark:text-blue-400">{formatRupiah(data?.nilai_jual_stok ?? 0)}</p>
            </div>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Unit Berkontribusi Modal Terbesar</p>
            <div className="space-y-2">
              {unitTersedia.slice(0, 5).map((u) => (
                <div key={u.id} className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                  <span className="text-xs font-semibold">{u.merek} {u.model}</span>
                  <div className="text-right">
                    <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">{formatRupiah(u.harga_beli || 0)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DetailModal>
      {/* Modal Report Periodic */}
      <DetailModal
        isOpen={Boolean(reportModalPeriod)}
        onClose={() => setReportModalPeriod(null)}
        title={`Laporan Keuangan: ${reportData?.period_label || reportModalPeriod?.toUpperCase()}`}
        subtitle="Rincian rekapitulasi omzet, HPP modal, laba bersih, dan histori transaksi"
      >
        {loadingReport ? (
          <div className="py-12 text-center text-xs text-slate-400">Memuat data laporan...</div>
        ) : (
          <div className="space-y-4">
            {/* Action Bar */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Ekspor data lengkap ke lembar kerja Excel (.xlsx asli 4-Sheet)
              </span>
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-8"
                onClick={() => downloadExcel(reportModalPeriod)}
              >
                <Download className="w-3.5 h-3.5 mr-1.5" /> Unduh .XLSX
              </Button>
            </div>

            {/* Metrics Breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400">Total Transaksi</span>
                <p className="font-heading font-extrabold text-lg text-slate-900 dark:text-white mt-0.5">
                  {reportData?.summary?.total_transaksi || 0} Trx
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400">Unit HP Terjual</span>
                <p className="font-heading font-extrabold text-lg text-blue-600 dark:text-blue-400 mt-0.5">
                  {reportData?.summary?.total_unit_terjual || 0} Unit
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 col-span-2 sm:col-span-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">Total Omzet</span>
                <p className="font-heading font-extrabold text-lg text-emerald-600 dark:text-emerald-400 mt-0.5 font-mono-tabular">
                  {formatRupiah(reportData?.summary?.total_omzet || 0)}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400">Total HPP Modal</span>
                <p className="font-heading font-bold text-sm text-slate-700 dark:text-slate-300 mt-0.5 font-mono-tabular">
                  {formatRupiah(reportData?.summary?.total_hpp || 0)}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400">Biaya / Beban</span>
                <p className="font-heading font-bold text-sm text-rose-600 dark:text-rose-400 mt-0.5 font-mono-tabular">
                  {formatRupiah(reportData?.summary?.total_pengeluaran || 0)}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 col-span-2 sm:col-span-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">Laba Bersih Akhir</span>
                <p className="font-heading font-extrabold text-base text-emerald-600 dark:text-emerald-400 mt-0.5 font-mono-tabular">
                  {formatRupiah(reportData?.summary?.laba_bersih || 0)}
                </p>
              </div>
            </div>

            {/* List of units sold in period */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Daftar Unit Terjual Pada Periode Ini ({reportData?.sold_units?.length || 0})
              </p>
              {(!reportData?.sold_units || reportData.sold_units.length === 0) ? (
                <p className="text-xs text-slate-400 py-6 text-center">Belum ada transaksi di periode ini.</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {reportData.sold_units.map((u, i) => (
                    <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-xs">
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-slate-200">{u.merek} {u.model}</p>
                        <p className="text-[10px] text-slate-500 font-mono">Trx: {u.nomor_transaksi} · IMEI: {u.imei}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-emerald-600 dark:text-emerald-400 font-mono-tabular">{formatRupiah(u.harga_jual)}</p>
                        <p className="text-[10px] text-slate-400">Laba: {formatRupiah(u.laba)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DetailModal>
    </div>
  );
}
