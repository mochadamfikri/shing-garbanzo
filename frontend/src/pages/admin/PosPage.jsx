import { useState } from "react";
import { Link } from "react-router-dom";
import { api, formatApiErrorDetail } from "@/lib/api";
import { formatRupiah } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import ImeiScanner from "@/components/ImeiScanner";
import { toast } from "sonner";
import {
  ScanLine,
  Plus,
  Trash2,
  ShoppingCart,
  CheckCircle2,
  Smartphone,
  CreditCard,
  Banknote,
  QrCode,
  AlertTriangle
} from "lucide-react";

export default function PosPage() {
  const [imei, setImei] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [missing, setMissing] = useState("");
  const [method, setMethod] = useState("TUNAI");
  const [customerName, setCustomerName] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastSale, setLastSale] = useState(null);
  const [transactionKey, setTransactionKey] = useState(() => crypto.randomUUID());

  const lookup = async (value = imei) => {
    const code = String(value || "").trim();
    if (!/^\d{15}$/.test(code)) return toast.error("Nomor IMEI harus tepat 15 digit angka");
    setLoading(true);
    setMissing("");
    try {
      const { data } = await api.get("/pos/lookup", { params: { imei: code } });
      if (!data.ditemukan) {
        setMissing(code);
        toast.warning(data.pesan || "IMEI tidak ditemukan dalam inventaris");
        return;
      }
      if (!data.boleh_dijual) {
        toast.warning(data.pesan || "Unit tidak dapat dijual (Status: " + data.unit.status_stok + ")");
        return;
      }
      if (items.some((x) => x.id === data.unit.id)) {
        toast.warning("Unit HP ini sudah berada di keranjang kasir");
        return;
      }
      setItems((prev) => [...prev, { ...data.unit, diskon: 0 }]);
      setImei("");
      toast.success(`${data.unit.merek} ${data.unit.model} dimasukkan ke keranjang kasir`);
    } catch (e) {
      toast.error(formatApiErrorDetail(e?.response?.data?.detail) || "Gagal melakukan pencarian IMEI");
    } finally {
      setLoading(false);
    }
  };

  const removeItem = (id) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
  };

  const updateDiscount = (id, diskonValue) => {
    const val = Math.max(0, Number(diskonValue) || 0);
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, diskon: val } : it))
    );
  };

  const subtotal = items.reduce((n, x) => n + Number(x.harga_jual || 0), 0);
  const totalDiskon = items.reduce((n, x) => n + Number(x.diskon || 0), 0);
  const totalBayar = Math.max(0, subtotal - totalDiskon);

  const submit = async () => {
    if (!items.length || busy) return;
    if (!window.confirm(`Konfirmasi pelunasan senilai ${formatRupiah(totalBayar)} via ${method}? Unit akan otomatis ditandai TERJUAL.`)) {
      return;
    }
    setBusy(true);
    try {
      const payload = {
        items: items.map((x) => ({ unit_id: x.id, diskon: Number(x.diskon || 0) })),
        metode_pembayaran: method,
        pembayaran_terverifikasi: true,
        pelanggan: customerName,
        catatan: notes,
        idempotency_key: transactionKey,
      };
      const { data } = await api.post("/pos/sales", payload);
      setLastSale(data);
      setItems([]);
      setCustomerName("");
      setNotes("");
      setTransactionKey(crypto.randomUUID());
      toast.success("Transaksi kasir berhasil disimpan! Stok termutasi menjadi TERJUAL.");
    } catch (e) {
      toast.error(formatApiErrorDetail(e?.response?.data?.detail) || "Transaksi kasir gagal diproses");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="pos-page">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <ScanLine className="w-6 h-6 text-blue-600 dark:text-blue-400" /> Kasir & Penjualan POS
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Pindai barcode/kamera atau input 15-digit IMEI untuk memproses transaksi unit HP
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: IMEI Scanner & Item List (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Scan/Input IMEI Card */}
          <Card className="p-4 sm:p-5 border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-2">
              Input / Pindai IMEI Unit HP
            </label>
            <div className="flex gap-2">
              <Input
                inputMode="numeric"
                autoComplete="off"
                placeholder="Ketik 15 digit IMEI..."
                value={imei}
                maxLength={15}
                onChange={(e) => setImei(e.target.value.replace(/\D/g, "").slice(0, 15))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    lookup();
                  }
                }}
                className="font-mono text-sm tracking-wider dark:bg-slate-800 dark:border-slate-700 h-11"
                data-testid="input-pos-imei"
              />
              <Button
                variant="outline"
                className="h-11 px-3.5 border-slate-300 dark:border-slate-700"
                onClick={() => setScannerOpen(true)}
                aria-label="Scan Kamera"
              >
                <ScanLine className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </Button>
              <Button
                className="h-11 px-5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs"
                onClick={() => lookup()}
                disabled={loading || imei.length < 15}
                data-testid="btn-pos-lookup"
              >
                {loading ? "Cari..." : "Tambah"}
              </Button>
            </div>

            {missing && (
              <div className="mt-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800 dark:text-amber-300">
                    IMEI <b>{missing}</b> belum ada di database inventaris.
                  </p>
                </div>
                <Link
                  to="/admin/inventaris/baru"
                  className="text-xs font-bold text-amber-900 dark:text-amber-200 underline shrink-0"
                >
                  + Daftarkan Unit
                </Link>
              </div>
            )}
          </Card>

          {/* Cart Items List */}
          <Card className="p-4 sm:p-5 border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <span className="font-heading font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <ShoppingCart className="w-4 h-4 text-slate-400" /> Unit yang Akan Dijual ({items.length})
              </span>
              {items.length > 0 && (
                <button
                  onClick={() => setItems([])}
                  className="text-xs text-rose-500 hover:underline"
                >
                  Kosongkan
                </button>
              )}
            </div>

            {items.length === 0 ? (
              <div className="py-12 text-center text-slate-400 dark:text-slate-500 space-y-2">
                <Smartphone className="w-8 h-8 mx-auto opacity-40" />
                <p className="text-xs">Keranjang kasir masih kosong. Masukkan nomor IMEI unit.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((it) => (
                  <div
                    key={it.id}
                    className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-0.5">
                      <p className="font-semibold text-sm text-slate-900 dark:text-white">
                        {it.merek} {it.model}
                      </p>
                      <p className="text-xs text-slate-500 font-mono">
                        IMEI: {it.imei_1} · {it.warna || "No Color"} ({it.kondisi || "BEKAS"})
                      </p>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3">
                      <div className="text-right">
                        <span className="text-xs text-slate-400 block">Harga Jual</span>
                        <span className="font-bold text-sm text-slate-900 dark:text-white font-mono-tabular">
                          {formatRupiah(it.harga_jual)}
                        </span>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(it.id)}
                        className="h-8 w-8 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Checkout Summary & Payment (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="p-4 sm:p-5 border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
            <h3 className="font-heading font-bold text-sm text-slate-800 dark:text-slate-200 pb-2 border-b border-slate-100 dark:border-slate-800">
              Rincian Pembayaran
            </h3>

            {/* Payment Method Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                Metode Pembayaran
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "TUNAI", label: "Tunai", icon: Banknote },
                  { id: "TRANSFER", label: "Transfer", icon: CreditCard },
                  { id: "QRIS_MANUAL", label: "QRIS", icon: QrCode },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMethod(m.id)}
                    className={`py-2 px-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 text-xs font-semibold transition-all ${
                      method === m.id
                        ? "border-blue-600 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 shadow-sm"
                        : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    <m.icon className="w-4 h-4" />
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Customer Details */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                Nama Pembeli (Opsional)
              </label>
              <Input
                placeholder="Contoh: Budi Santoso"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="text-xs dark:bg-slate-800 dark:border-slate-700 h-9"
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                Catatan Kasir
              </label>
              <Input
                placeholder="Kelengkapan unit, garansi toko, dll."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="text-xs dark:bg-slate-800 dark:border-slate-700 h-9"
              />
            </div>

            {/* Calculations Breakdown */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Subtotal ({items.length} unit)</span>
                <span className="font-mono">{formatRupiah(subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Potongan / Diskon</span>
                <span className="font-mono text-emerald-600">-{formatRupiah(totalDiskon)}</span>
              </div>
              <div className="flex justify-between items-baseline pt-2 border-t border-slate-200 dark:border-slate-800">
                <span className="font-bold text-sm text-slate-900 dark:text-white">Total Tagihan</span>
                <span className="font-heading font-extrabold text-xl text-blue-600 dark:text-blue-400 font-mono-tabular">
                  {formatRupiah(totalBayar)}
                </span>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-500/20"
              disabled={items.length === 0 || busy}
              onClick={submit}
              data-testid="btn-pos-submit"
            >
              {busy ? "Menyimpan Transaksi..." : `Selesaikan & Tandai Terjual (${formatRupiah(totalBayar)})`}
            </Button>
          </Card>

          {/* Success Invoice Alert */}
          {lastSale && (
            <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <span className="font-bold text-sm">Penjualan Berhasil Disimpan!</span>
              </div>
              <div className="text-xs space-y-0.5">
                <p>Nomor Struk: <b className="font-mono">{lastSale.nomor_transaksi}</b></p>
                <p>Total Dibayar: <b>{formatRupiah(lastSale.penjualan_bersih)}</b> ({lastSale.metode_pembayaran})</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <ImeiScanner open={scannerOpen} onOpenChange={setScannerOpen} onCapture={lookup} />
    </div>
  );
}
