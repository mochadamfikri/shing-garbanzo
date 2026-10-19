import { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { api, formatApiErrorDetail } from "@/lib/api";
import { formatRupiah } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import SmartScannerModal from "@/components/SmartScannerModal";
import ImeiScanner from "@/components/ImeiScanner";
import {
  ScanLine,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Smartphone,
  ShieldCheck,
  Wallet,
  Sparkles,
  Layers,
  Plus
} from "lucide-react";

const JALUR_OPTIONS = ["Inter", "Regist Cukai", "iBox", "Blibli", "Digimap"];
const SINYAL_OPTIONS = ["Sinyal Aman", "No Signal", "SIM-Lock", "Belum Diperiksa"];
const KELENGKAPAN_OPTIONS = ["Fullset", "Unit Only"];
const ASAL_OPTIONS = ["Distributor", "COD", "Tukar Tambah", "Titipan", "Lainnya"];
const KONDISI_OPTIONS = ["BARU", "BEKAS"];
const ADDONS_LIST = ["Charger", "Softcase", "Kabel Data", "Tempered Glass", "Dus Pengganti"];

export default function InventoryFormPage({ mode = "create" }) {
  const nav = useNavigate();
  const { id } = useParams();

  // Wizard Stage (1 to 4)
  const [stage, setStage] = useState(1);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [singleScannerOpen, setSingleScannerOpen] = useState(false);
  const [targetImeiField, setTargetImeiField] = useState("imei_1");
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    // Tahap 1: Identitas
    merek: "Apple",
    model: "iPhone 15",
    varian: "",
    penyimpanan: "128GB",
    warna: "Pink",
    ram: "",
    kondisi: "BEKAS",
    part_number: "",
    model_number: "",
    eid: "",
    serial_number: "",
    imei_1: "",
    imei_2: "",
    upc: "",

    // Tahap 2: Jalur & Kondisi
    jalur_distributor: "Inter",
    status_sinyal: "Sinyal Aman",
    kelengkapan: "Fullset",
    addons: [],
    asal_unit: "Distributor",
    catatan_pemeriksaan: "",

    // Tahap 3: Keuangan
    harga_beli: "",
    ada_biaya_reparasi: false,
    biaya_reparasi: "",
    biaya_operasional: "",
    ongkos_cod: "",
    ongkos_bensin: "",
    ongkos_lain: "",
    harga_jual: "", // Boleh kosong

    // Metadata
    status_stok: "TERSEDIA",
    status_publikasi: "TAYANG"
  });

  // Load master catalog on mount
  useEffect(() => {
    api.get("/master-catalog")
      .then((res) => {
        if (res.data?.brands) setCatalog(res.data.brands);
      })
      .catch(() => {});

    if (mode === "edit" && id) {
      setLoading(true);
      api.get(`/inventory/${id}`)
        .then((res) => {
          setFormData((prev) => ({ ...prev, ...res.data }));
        })
        .catch((e) => toast.error(formatApiErrorDetail(e?.response?.data?.detail) || "Gagal memuat data unit"))
        .finally(() => setLoading(false));
    }
  }, [mode, id]);

  // Catalog selectors
  const availableBrands = useMemo(() => catalog.map((c) => c.brand), [catalog]);
  const currentBrandDoc = useMemo(() => catalog.find((c) => c.brand.toLowerCase() === formData.merek.toLowerCase()), [catalog, formData.merek]);
  const availableModels = useMemo(() => currentBrandDoc?.models?.map((m) => m.name) || [], [currentBrandDoc]);
  const currentModelDoc = useMemo(() => currentBrandDoc?.models?.find((m) => m.name.toLowerCase() === formData.model.toLowerCase()), [currentBrandDoc, formData.model]);
  const availableStorages = useMemo(() => currentModelDoc?.storages || ["64GB", "128GB", "256GB", "512GB", "1TB"], [currentModelDoc]);
  const availableColors = useMemo(() => currentModelDoc?.colors || ["Black", "White", "Blue", "Natural Titanium"], [currentModelDoc]);

  const updateField = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleScanComplete = (fields) => {
    setFormData((prev) => {
      const next = { ...prev };
      if (fields.merek) next.merek = fields.merek;
      if (fields.model) next.model = fields.model;
      if (fields.penyimpanan) next.penyimpanan = fields.penyimpanan;
      if (fields.warna) next.warna = fields.warna;
      if (fields.part_number) next.part_number = fields.part_number;
      if (fields.model_number) next.model_number = fields.model_number;
      if (fields.eid) next.eid = fields.eid;
      if (fields.serial_number) next.serial_number = fields.serial_number;
      if (fields.imei_1) next.imei_1 = fields.imei_1;
      if (fields.imei_2) next.imei_2 = fields.imei_2;
      if (fields.upc) next.upc = fields.upc;
      return next;
    });
    toast.success("Data hasil scan berhasil dimasukkan ke formulir!");
  };

  const toggleAddon = (item) => {
    setFormData((prev) => {
      const exists = prev.addons.includes(item);
      const next = exists ? prev.addons.filter((x) => x !== item) : [...prev.addons, item];
      return { ...prev, addons: next };
    });
  };

  // Stage validations
  const validateStage1 = () => {
    if (!formData.merek || !formData.model) {
      toast.error("Merek dan Model unit wajib dipilih");
      return false;
    }
    const imei = String(formData.imei_1 || "").trim();
    if (!/^\d{15}$/.test(imei)) {
      toast.error("IMEI 1 harus tepat 15 digit angka");
      return false;
    }
    return true;
  };

  const nextStage = () => {
    if (stage === 1 && !validateStage1()) return;
    setStage((s) => Math.min(4, s + 1));
  };

  const prevStage = () => {
    setStage((s) => Math.max(1, s - 1));
  };

  // Total modal calculation
  const totalModal = useMemo(() => {
    const beli = Number(formData.harga_beli) || 0;
    const rep = formData.ada_biaya_reparasi ? (Number(formData.biaya_reparasi) || 0) : 0;
    const op = Number(formData.biaya_operasional) || 0;
    return beli + rep + op;
  }, [formData.harga_beli, formData.ada_biaya_reparasi, formData.biaya_reparasi, formData.biaya_operasional]);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const payload = {
        ...formData,
        harga_beli: Number(formData.harga_beli) || 0,
        biaya_reparasi: formData.ada_biaya_reparasi ? (Number(formData.biaya_reparasi) || 0) : 0,
        biaya_operasional: Number(formData.biaya_operasional) || 0,
        harga_jual: formData.harga_jual ? Number(formData.harga_jual) : null
      };

      if (mode === "create") {
        await api.post("/inventory", payload);
        toast.success(`Unit ${formData.merek} ${formData.model} berhasil ditambahkan ke Data Unit!`);
      } else {
        await api.patch(`/inventory/${id}`, payload);
        toast.success(`Unit ${formData.merek} ${formData.model} berhasil diperbarui!`);
      }
      nav("/admin/inventaris");
    } catch (e) {
      toast.error(formatApiErrorDetail(e?.response?.data?.detail) || "Gagal menyimpan unit");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12" data-testid="inventory-form-page">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/admin/inventaris">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="font-heading text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
              {mode === "create" ? "Tambah Data Unit Baru" : "Edit Data Unit"}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Tahap {stage} dari 4: {stage === 1 ? "Identitas Perangkat" : stage === 2 ? "Jalur & Kondisi" : stage === 3 ? "Keuangan Unit" : "Review & Simpan"}
            </p>
          </div>
        </div>

        {stage === 1 && (
          <Button
            type="button"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-9 shadow-sm"
            onClick={() => setScannerOpen(true)}
          >
            <ScanLine className="w-4 h-4 mr-1.5" /> Smart Device Scan
          </Button>
        )}
      </div>

      {/* 4-Step Indicator Bar (Clickable directly to jump to any stage) */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { num: 1, label: "Identitas" },
          { num: 2, label: "Jalur & Sinyal" },
          { num: 3, label: "Keuangan" },
          { num: 4, label: "Konfirmasi" }
        ].map((s) => (
          <button
            key={s.num}
            type="button"
            onClick={() => setStage(s.num)}
            className={`py-2.5 px-1 text-center rounded-xl border transition-all cursor-pointer ${
              stage === s.num
                ? "border-blue-600 bg-blue-600 text-white font-bold shadow-sm shadow-blue-500/20"
                : stage > s.num
                ? "border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold"
                : "border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold"
            }`}
          >
            <span className="text-[10px] block sm:inline mr-1">{s.num}.</span>
            <span className="text-xs truncate">{s.label}</span>
          </button>
        ))}
      </div>

      {/* ============================================================== */}
      {/* TAHAP 1: IDENTITAS PERANGKAT                                    */}
      {/* ============================================================== */}
      {stage === 1 && (
        <Card className="p-5 sm:p-6 border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <span className="font-heading font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-blue-600" /> Spesifikasi & Nomor Identifikasi Fisik
            </span>
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              <Sparkles className="w-3.5 h-3.5" /> Isi Otomatis via Scanner
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Brand Dropdown (Select native) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Merek / Brand *</Label>
                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold">{availableBrands.length} Brand Terdaftar</span>
              </div>
              <select
                value={formData.merek}
                onChange={(e) => updateField("merek", e.target.value)}
                className="w-full h-11 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold"
              >
                {availableBrands.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            {/* Model Dropdown (Select native showing all models for selected brand) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Model Perangkat *</Label>
                <span className="text-[10px] text-slate-400">{availableModels.length} Model Tersedia</span>
              </div>
              <select
                value={formData.model}
                onChange={(e) => updateField("model", e.target.value)}
                className="w-full h-11 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold"
              >
                <option value="">-- Pilih Model {formData.merek} --</option>
                {availableModels.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* Storage */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Kapasitas Penyimpanan</Label>
              <select
                value={formData.penyimpanan}
                onChange={(e) => updateField("penyimpanan", e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono"
              >
                {availableStorages.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Color */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Warna Fisik</Label>
              <input
                list="color-list"
                value={formData.warna}
                onChange={(e) => updateField("warna", e.target.value)}
                placeholder="Contoh: Pink, Midnight..."
                className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
              />
              <datalist id="color-list">
                {availableColors.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>

            {/* Part Number */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Part Number / SKU</Label>
              <Input
                value={formData.part_number}
                onChange={(e) => updateField("part_number", e.target.value.toUpperCase())}
                placeholder="Contoh: MTP13SA/A"
                className="font-mono text-sm h-10 dark:bg-slate-800 dark:border-slate-700"
              />
            </div>

            {/* Model Number */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Model Number</Label>
              <Input
                value={formData.model_number}
                onChange={(e) => updateField("model_number", e.target.value.toUpperCase())}
                placeholder="Contoh: A3090 / SM-S928B"
                className="font-mono text-sm h-10 dark:bg-slate-800 dark:border-slate-700"
              />
            </div>

            {/* Serial Number */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Nomor Seri (Serial No)</Label>
              <Input
                value={formData.serial_number}
                onChange={(e) => updateField("serial_number", e.target.value.toUpperCase())}
                placeholder="Contoh: H7XG29V0QP"
                className="font-mono text-sm h-10 dark:bg-slate-800 dark:border-slate-700"
              />
            </div>

            {/* EID (eSIM ID) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">EID (eSIM)</Label>
              <Input
                value={formData.eid}
                onChange={(e) => updateField("eid", e.target.value.replace(/\D/g, "").slice(0, 32))}
                placeholder="32 digit angka EID"
                className="font-mono text-xs h-10 dark:bg-slate-800 dark:border-slate-700"
              />
            </div>

            {/* IMEI 1 */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                IMEI 1 (Utama) *
              </Label>
              <div className="flex gap-1.5">
                <Input
                  value={formData.imei_1}
                  maxLength={15}
                  inputMode="numeric"
                  onChange={(e) => updateField("imei_1", e.target.value.replace(/\D/g, "").slice(0, 15))}
                  placeholder="15 digit IMEI 1"
                  className="font-mono text-sm h-11 border-blue-400 dark:border-blue-600 dark:bg-slate-800"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 shrink-0 border-blue-300 dark:border-blue-800"
                  onClick={() => {
                    setTargetImeiField("imei_1");
                    setSingleScannerOpen(true);
                  }}
                  aria-label="Scan Barcode IMEI 1"
                >
                  <ScanLine className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </Button>
              </div>
            </div>

            {/* IMEI 2 */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">IMEI 2 (Opsional)</Label>
              <div className="flex gap-1.5">
                <Input
                  value={formData.imei_2}
                  maxLength={15}
                  inputMode="numeric"
                  onChange={(e) => updateField("imei_2", e.target.value.replace(/\D/g, "").slice(0, 15))}
                  placeholder="15 digit IMEI 2"
                  className="font-mono text-sm h-11 dark:bg-slate-800 dark:border-slate-700"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 shrink-0 dark:border-slate-700"
                  onClick={() => {
                    setTargetImeiField("imei_2");
                    setSingleScannerOpen(true);
                  }}
                  aria-label="Scan Barcode IMEI 2"
                >
                  <ScanLine className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* ============================================================== */}
      {/* TAHAP 2: JALUR DISTRIBUTOR & STATUS SINYAL                      */}
      {/* ============================================================== */}
      {stage === 2 && (
        <Card className="p-5 sm:p-6 border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
          <span className="font-heading font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <ShieldCheck className="w-4 h-4 text-emerald-600" /> Jalur Masuk, Kondisi Sinyal & Kelengkapan
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Jalur Distributor */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Jalur / Distributor *</Label>
              <select
                value={formData.jalur_distributor}
                onChange={(e) => updateField("jalur_distributor", e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold"
              >
                {JALUR_OPTIONS.map((j) => (
                  <option key={j} value={j}>{j}</option>
                ))}
              </select>
            </div>

            {/* Status Sinyal */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Status Sinyal Jaringan *</Label>
              <select
                value={formData.status_sinyal}
                onChange={(e) => updateField("status_sinyal", e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold"
              >
                {SINYAL_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Kelengkapan */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Kelengkapan Paket</Label>
              <div className="grid grid-cols-2 gap-2">
                {KELENGKAPAN_OPTIONS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => updateField("kelengkapan", k)}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                      formData.kelengkapan === k
                        ? "border-blue-600 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-bold"
                        : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>

            {/* Asal Unit */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Diperoleh Dari (Asal Unit)</Label>
              <select
                value={formData.asal_unit}
                onChange={(e) => updateField("asal_unit", e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
              >
                {ASAL_OPTIONS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Add-ons Checkboxes */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
              Aksesori Tambahan (Add-ons Opsional)
            </Label>
            <div className="flex flex-wrap gap-2">
              {ADDONS_LIST.map((addon) => {
                const checked = formData.addons.includes(addon);
                return (
                  <button
                    key={addon}
                    type="button"
                    onClick={() => toggleAddon(addon)}
                    className={`py-1.5 px-3 rounded-lg border text-xs font-medium transition-all ${
                      checked
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-semibold"
                        : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    {checked ? "✓ " : "+ "} {addon}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5 pt-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Catatan Fisik / Riwayat Servis</Label>
            <Input
              value={formData.catatan_pemeriksaan}
              onChange={(e) => updateField("catatan_pemeriksaan", e.target.value)}
              placeholder="Contoh: Battery health 98%, TrueTone on, mulus 99%"
              className="text-xs dark:bg-slate-800 dark:border-slate-700 h-10"
            />
          </div>
        </Card>
      )}

      {/* ============================================================== */}
      {/* TAHAP 3: KEUANGAN UNIT                                         */}
      {/* ============================================================== */}
      {stage === 3 && (
        <Card className="p-5 sm:p-6 border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
          <span className="font-heading font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <Wallet className="w-4 h-4 text-indigo-600" /> Modal Pembelian, Reparasi, & Harga Jual
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Harga Beli */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Harga Beli (Modal Awal) *
              </Label>
              <Input
                type="number"
                value={formData.harga_beli}
                onChange={(e) => updateField("harga_beli", e.target.value)}
                placeholder="Rp 0"
                className="font-mono text-base font-bold dark:bg-slate-800 dark:border-slate-700 h-11"
              />
            </div>

            {/* Biaya Operasional */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Biaya Operasional (COD / Bensin / Logistik)
              </Label>
              <Input
                type="number"
                value={formData.biaya_operasional}
                onChange={(e) => updateField("biaya_operasional", e.target.value)}
                placeholder="Rp 0"
                className="font-mono text-sm dark:bg-slate-800 dark:border-slate-700 h-11"
              />
            </div>
          </div>

          {/* Toggle Ada Biaya Reparasi */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.ada_biaya_reparasi}
                onChange={(e) => updateField("ada_biaya_reparasi", e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Ada Biaya Reparasi / Penggantian Part
              </span>
            </label>

            {formData.ada_biaya_reparasi && (
              <div className="pl-6 pt-1 space-y-1.5">
                <Label className="text-xs text-slate-500">Nominal Biaya Reparasi (Rp)</Label>
                <Input
                  type="number"
                  value={formData.biaya_reparasi}
                  onChange={(e) => updateField("biaya_reparasi", e.target.value)}
                  placeholder="Contoh: 350000 (ganti baterai/layar)"
                  className="font-mono text-sm h-10 dark:bg-slate-800 dark:border-slate-700"
                />
              </div>
            )}
          </div>

          {/* Total Modal Box */}
          <div className="p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900 flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-900 dark:text-indigo-300">
              Total Beban Modal (HPP):
            </span>
            <span className="font-heading font-extrabold text-base text-indigo-700 dark:text-indigo-400 font-mono-tabular">
              {formatRupiah(totalModal)}
            </span>
          </div>

          {/* Harga Jual Rencana (Opsional) */}
          <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Harga Jual Rencana (Opsional)
              </Label>
              <span className="text-[11px] text-slate-400">Boleh dikosongkan & ditentukan saat kasir</span>
            </div>
            <Input
              type="number"
              value={formData.harga_jual}
              onChange={(e) => updateField("harga_jual", e.target.value)}
              placeholder="Kosongkan jika belum ditentukan"
              className="font-mono text-sm h-11 dark:bg-slate-800 dark:border-slate-700"
            />
          </div>
        </Card>
      )}

      {/* ============================================================== */}
      {/* TAHAP 4: REVIEW & KONFIRMASI                                   */}
      {/* ============================================================== */}
      {stage === 4 && (
        <Card className="p-5 sm:p-6 border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
          <span className="font-heading font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <CheckCircle2 className="w-4 h-4 text-blue-600" /> Konfirmasi Seluruh Data Unit
          </span>

          <div className="space-y-3 text-xs">
            {/* Identity Summary */}
            <div className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Unit Fisik</span>
              <p className="text-base font-bold text-slate-900 dark:text-white">
                {formData.merek} {formData.model} ({formData.penyimpanan} - {formData.warna})
              </p>
              <div className="grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-300 font-mono mt-2">
                <p>IMEI 1: <b>{formData.imei_1}</b></p>
                {formData.imei_2 && <p>IMEI 2: <b>{formData.imei_2}</b></p>}
                {formData.serial_number && <p>Serial: <b>{formData.serial_number}</b></p>}
                {formData.part_number && <p>Part No: <b>{formData.part_number}</b></p>}
                {formData.model_number && <p>Model No: <b>{formData.model_number}</b></p>}
                {formData.eid && <p className="truncate">EID: <b>{formData.eid}</b></p>}
              </div>
            </div>

            {/* Condition & Logistics */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Jalur & Sinyal</span>
                <p className="font-semibold text-slate-800 dark:text-slate-200 mt-1">{formData.jalur_distributor}</p>
                <p className="text-emerald-600 font-medium">{formData.status_sinyal}</p>
              </div>

              <div className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Kelengkapan</span>
                <p className="font-semibold text-slate-800 dark:text-slate-200 mt-1">{formData.kelengkapan}</p>
                <p className="text-slate-500">{formData.addons.length ? formData.addons.join(", ") : "Tanpa add-ons"}</p>
              </div>
            </div>

            {/* Finance Review */}
            <div className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Kalkulasi Modal</span>
              <div className="flex justify-between font-mono">
                <span>Harga Beli (Modal):</span>
                <span>{formatRupiah(formData.harga_beli || 0)}</span>
              </div>
              {formData.ada_biaya_reparasi && (
                <div className="flex justify-between font-mono text-purple-600">
                  <span>Biaya Reparasi:</span>
                  <span>+{formatRupiah(formData.biaya_reparasi || 0)}</span>
                </div>
              )}
              {Boolean(formData.biaya_operasional) && (
                <div className="flex justify-between font-mono text-slate-500">
                  <span>Biaya Operasional:</span>
                  <span>+{formatRupiah(formData.biaya_operasional || 0)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm pt-1 border-t border-slate-200 dark:border-slate-700">
                <span>Total Modal (HPP):</span>
                <span className="text-indigo-600 dark:text-indigo-400 font-mono-tabular">{formatRupiah(totalModal)}</span>
              </div>
              <div className="flex justify-between text-xs pt-1 text-slate-500">
                <span>Harga Jual Rencana:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {formData.harga_jual ? formatRupiah(formData.harga_jual) : "Belum Ditentukan"}
                </span>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Navigation Buttons between Stages */}
      <div className="flex items-center justify-between pt-2">
        {stage > 1 ? (
          <Button variant="outline" onClick={prevStage} className="h-10 text-xs">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Kembali
          </Button>
        ) : <div />}

        {stage < 4 ? (
          <Button onClick={nextStage} className="h-10 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-5">
            Lanjut ke Tahap {stage + 1} <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-6 shadow-md shadow-emerald-500/20"
          >
            {saving ? "Menyimpan Unit..." : "Konfirmasi & Simpan ke Data Unit"}
          </Button>
        )}
      </div>

      {/* Smart Device Scanner Modal */}
      <SmartScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanComplete={handleScanComplete}
      />

      {/* Single IMEI Barcode Camera Scanner */}
      <ImeiScanner
        open={singleScannerOpen}
        onOpenChange={setSingleScannerOpen}
        onCapture={(scannedImei) => {
          updateField(targetImeiField, scannedImei);
          toast.success(`IMEI berhasil diisi: ${scannedImei}`);
        }}
      />
    </div>
  );
}
