import { useCallback, useEffect, useRef, useState } from "react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { formatRupiah } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import ImeiScanner from "@/components/ImeiScanner";
import { AlertCircle, CheckCircle2, RefreshCw, ScanLine, Smartphone } from "lucide-react";

const SERVICES = [
  { code: "cek_imei", name: "Status IMEI", description: "REGISTERED, UNKNOWN, ROAMER dan status dari CeirGO" },
  { code: "cek_sf", name: "Roamer / SF", description: "Status roamer pada layanan SF" },
  { code: "cek_digi", name: "Roamer / DIGI", description: "Status roamer pada layanan DIGI" },
  { code: "cek_imei_beacukai", name: "Registrasi Bea Cukai", description: "Pendaftaran IMEI melalui jalur Bea Cukai" },
  { code: "cek_validity", name: "Masa Aktif IMEI", description: "Tanggal berlaku jika tersedia dari penyedia" },
];
const ACTIVATION_MESSAGE = "Belum bisa digunakan, silakan aktivasi terlebih dahulu.";
const RESULT_LABELS = {
  REGISTERED: "Terdaftar",
  UNREGISTERED: "Belum terdaftar",
  UNKNOWN: "Status tidak diketahui",
  ROAMER: "Roamer",
  SF_ROAMER: "SF Roamer",
  DIGI_ROAMER: "DIGI Roamer",
  BLOCKED: "Blocked",
  ERROR: "Gagal diperiksa oleh penyedia",
  NO_RECORD: "Tidak ada catatan",
  NO_GIDI: "Tidak ada catatan DIGI",
  VALID: "Masih berlaku",
  EXPIRED: "Masa berlaku habis",
  DUPLICATE: "Duplikat",
};
function errorMessage(error) {
  const detail = error?.response?.data?.detail;
  if (detail && typeof detail === "object" && typeof detail.message === "string") return detail.message;
  return formatApiErrorDetail(detail) || "Terjadi kendala saat menghubungi layanan.";
}

export default function ImeiCheckPage() {
  const [imei, setImei] = useState("");
  const [service, setService] = useState("cek_imei");
  const [readiness, setReadiness] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [busy, setBusy] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const version = useRef(0);
  const busyRef = useRef(false);

  const loadStatus = useCallback(async (code) => {
    const requestId = ++version.current;
    setLoadingStatus(true);
    try {
      const response = await api.get("/imei-check/status", { params: { service_code: code } });
      if (version.current === requestId) setReadiness(response.data);
    } catch (err) {
      if (version.current === requestId) {
        setReadiness({ state: "provider_unavailable", message: errorMessage(err), price: null });
      }
    } finally {
      if (version.current === requestId) setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    setResult(null);
    setError("");
    setReadiness(null);
    loadStatus(service);
    return () => { version.current += 1; };
  }, [service, loadStatus]);

  const changeImei = (value) => {
    setImei(String(value || "").replace(/\D/g, "").slice(0, 15));
    setResult(null);
    setError("");
  };

  const submit = async () => {
    if (busyRef.current) return;
    if (!/^\d{15}$/.test(imei)) {
      setError("Masukkan IMEI yang berisi tepat 15 angka.");
      return;
    }
    if (readiness?.state !== "ready") {
      setError(readiness?.message || ACTIVATION_MESSAGE);
      return;
    }
    const confirmation = window.confirm(
      "Pengecekan ini dikenakan biaya CeirGO " +
      formatRupiah(readiness.price) + " per IMEI. Lanjutkan pengecekan berbayar?"
    );
    if (!confirmation) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const response = await api.post("/imei-check", { imei, service_code: service });
      setResult(response.data);
      await loadStatus(service);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      const state = detail?.state;
      setError(errorMessage(err));
      if (state === "activation_required") setReadiness({ state, message: ACTIVATION_MESSAGE });
      if (state === "outcome_unknown") {
        setResult({ state: "outcome_unknown", message: detail.message });
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const refreshOrder = async () => {
    if (!result?.order_id || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await api.get("/imei-check/orders/" + result.order_id);
      setResult(response.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const activationRequired = readiness?.state === "activation_required";
  const ready = readiness?.state === "ready";
  const checked = result?.state === "processed";

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-8" data-testid="imei-check-page">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl md:text-3xl font-bold flex items-center gap-2">
          <Smartphone className="h-7 w-7 text-blue-600" /> Cek IMEI
        </h1>
        <p className="text-sm text-slate-500">
          Pengecekan status perangkat menggunakan CeirGO. Terpisah dari stok dan penjualan.
        </p>
      </div>

      <Card className="p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">Layanan CeirGO</h2>
          <Button type="button" size="sm" variant="outline" onClick={() => loadStatus(service)} disabled={loadingStatus || busy}>
            <RefreshCw className="h-4 w-4 mr-2" /> Perbarui Status
          </Button>
        </div>
        <label className="block space-y-1.5 text-sm font-medium">
          Jenis Pengecekan
          <select className="block w-full rounded-md border border-slate-300 p-3 bg-white min-h-11"
            value={service} onChange={(event) => setService(event.target.value)}
            disabled={busy} data-testid="imei-check-service">
            {SERVICES.map((option) => <option key={option.code} value={option.code}>{option.name}</option>)}
          </select>
        </label>
        <p className="text-sm text-slate-500">{SERVICES.find((s) => s.code === service)?.description}</p>
        <div role="status" data-testid="imei-provider-status"
          className={"rounded-lg border p-3 text-sm flex gap-2 items-start " +
            (ready ? "bg-emerald-50 border-emerald-200 text-emerald-900" :
             "bg-amber-50 border-amber-200 text-amber-900")}>
          {ready ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
          <div>
            <b>{loadingStatus ? "Memeriksa layanan..." :
              ready ? "Layanan siap digunakan" : activationRequired ?
              ACTIVATION_MESSAGE : readiness?.message || "Belum dapat memeriksa layanan"}</b>
            {ready && <p className="mt-1">Tarif pengecekan: {formatRupiah(readiness.price)} / IMEI.</p>}
            {activationRequired && <p className="mt-1">Hubungi pengelola untuk mengaktifkan layanan CeirGO.</p>}
          </div>
        </div>
      </Card>

      <Card className="p-4 md:p-6 space-y-3">
        <label className="text-sm font-semibold block" htmlFor="ceirgo-imei">Nomor IMEI</label>
        <div className="flex gap-2">
          <Input id="ceirgo-imei" inputMode="numeric" autoComplete="off" maxLength={15}
            placeholder="15 digit IMEI" data-testid="imei-check-input"
            value={imei} onChange={(e) => changeImei(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }} />
          <Button type="button" variant="outline" aria-label="Scan IMEI dengan kamera"
            onClick={() => setScannerOpen(true)} disabled={busy}>
            <ScanLine className="h-5 w-5" />
          </Button>
        </div>
        <Button className="w-full min-h-11" disabled={!ready || busy || loadingStatus}
          onClick={submit} data-testid="imei-check-submit">
          {busy ? "Memproses..." : "Cek IMEI"}
        </Button>
        {error && <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      </Card>

      {result && (
        <Card className="p-4 md:p-6 space-y-3" role="status" data-testid="imei-check-result">
          <h2 className="font-semibold">Hasil Pengecekan</h2>
          {result.reference_id && <p className="text-xs text-slate-500 break-all">Referensi: {result.reference_id}</p>}
          {checked && result.result ? (
            <div className="space-y-2">
              <p className="text-lg font-semibold">{RESULT_LABELS[result.result.status] || "Status belum teridentifikasi"}</p>
              <p className="text-xs text-slate-500">Kode hasil: {result.result.status || "UNKNOWN"}</p>
              {result.result.valid_until && <p className="text-sm">Berlaku sampai: {result.result.valid_until}</p>}
            </div>
          ) : <p className="text-sm">{result.message || "Sedang menunggu hasil pengecekan."}</p>}
          {result.order_id && result.state === "pending" && (
            <Button variant="outline" disabled={busy} onClick={refreshOrder}>
              <RefreshCw className="h-4 w-4 mr-2" /> Periksa Hasil
            </Button>
          )}
          <p className="text-xs text-slate-500">
            Hasil ini berasal dari penyedia CeirGO. UNKNOWN/tidak ada catatan tidak otomatis berarti IMEI blocked.
            Pengecekan ini tidak dapat membuka SIM Lock atau mendaftarkan IMEI.
          </p>
        </Card>
      )}
      <ImeiScanner open={scannerOpen} onOpenChange={setScannerOpen} onCapture={changeImei} />
    </div>
  );
}
