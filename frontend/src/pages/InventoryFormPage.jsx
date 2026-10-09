import { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { api, formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ScanLine, Upload, X, ArrowLeft, Camera } from "lucide-react";
import ImeiScanner from "@/components/ImeiScanner";
import { validateImeiClient } from "@/lib/luhn";
import { formatRupiah, parseRupiahInput } from "@/lib/format";

const EMPTY = {
  merek: "", model: "", varian: "", ram: "", penyimpanan: "", warna: "",
  jenis_perangkat: "INTER", kondisi: "BARU", grade_fisik: "", kesehatan_baterai: "",
  imei_1: "", imei_2: "", serial_number: "", kelengkapan: "", catatan_pemeriksaan: "",
  garansi: "", supplier: "",
  harga_beli: 0, biaya_reparasi: 0, biaya_tambahan: 0, harga_jual: 0,
  deskripsi: "",
  foto_urls: [], video_urls: [],
  status_stok: "TERSEDIA", status_publikasi: "DRAFT", produk_unggulan: false,
};

export default function InventoryFormPage({ mode = "create" }) {
  const { id } = useParams();
  const nav = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanTarget, setScanTarget] = useState("imei_1");
  const [imeiCheck1, setImeiCheck1] = useState({ ok: null, message: "" });
  const [imeiCheck2, setImeiCheck2] = useState({ ok: null, message: "" });
  const [saving, setSaving] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [uploadingVid, setUploadingVid] = useState(false);
  const [err, setErr] = useState("");

  const isEdit = mode === "edit";

  useEffect(() => {
    if (isEdit && id) {
      api.get(`/inventory/${id}`)
        .then((r) => setForm({ ...EMPTY, ...r.data, kesehatan_baterai: r.data.kesehatan_baterai ?? "" }))
        .catch((e) => setErr(formatApiErrorDetail(e?.response?.data?.detail) || e.message));
    }
  }, [isEdit, id]);

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const totalModal = useMemo(
    () => Number(form.harga_beli || 0) + Number(form.biaya_reparasi || 0) + Number(form.biaya_tambahan || 0),
    [form.harga_beli, form.biaya_reparasi, form.biaya_tambahan]
  );
  const estimasiLaba = useMemo(() => Number(form.harga_jual || 0) - totalModal, [form.harga_jual, totalModal]);

  const checkImei = async (which) => {
    const value = form[which];
    const localCheck = validateImeiClient(value);
    if (!localCheck.ok) {
      if (which === "imei_1") setImeiCheck1({ ok: false, message: localCheck.message });
      else setImeiCheck2({ ok: false, message: localCheck.message });
      return;
    }
    try {
      const { data } = await api.post("/inventory/validate-imei", { imei: value, exclude_id: isEdit ? id : null });
      const payload = { ok: data.valid && !data.duplicate, message: data.message };
      if (which === "imei_1") setImeiCheck1(payload); else setImeiCheck2(payload);
    } catch (e) {
      const msg = formatApiErrorDetail(e?.response?.data?.detail) || e.message;
      if (which === "imei_1") setImeiCheck1({ ok: false, message: msg });
      else setImeiCheck2({ ok: false, message: msg });
    }
  };

  const openScanner = (target) => { setScanTarget(target); setScannerOpen(true); };

  const onFile = async (e, kind) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const setting = kind === "image" ? setUploadingImg : setUploadingVid;
    setting(true);
    const results = [];
    for (const file of files) {
      const fd = new FormData();
      fd.append("file", file);
      try {
        const { data } = await api.post(`/uploads/${kind}`, fd, { headers: { "Content-Type": "multipart/form-data" } });
        results.push(data.url);
      } catch (err) {
        toast.error(formatApiErrorDetail(err?.response?.data?.detail) || "Upload gagal");
      }
    }
    if (results.length) {
      setForm((f) => ({
        ...f,
        [kind === "image" ? "foto_urls" : "video_urls"]: [...(f[kind === "image" ? "foto_urls" : "video_urls"] || []), ...results],
      }));
      toast.success(`${results.length} berkas diunggah`);
    }
    setting(false);
    e.target.value = "";
  };

  const removeMedia = (kind, url) => {
    setForm((f) => ({
      ...f,
      [kind === "image" ? "foto_urls" : "video_urls"]: (f[kind === "image" ? "foto_urls" : "video_urls"] || []).filter((u) => u !== url),
    }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    const check1 = validateImeiClient(form.imei_1);
    if (!check1.ok) { setErr(`IMEI 1: ${check1.message}`); return; }
    if (form.imei_2) {
      const check2 = validateImeiClient(form.imei_2);
      if (!check2.ok) { setErr(`IMEI 2: ${check2.message}`); return; }
    }

    const payload = {
      ...form,
      harga_beli: Number(form.harga_beli || 0),
      biaya_reparasi: Number(form.biaya_reparasi || 0),
      biaya_tambahan: Number(form.biaya_tambahan || 0),
      harga_jual: Number(form.harga_jual || 0),
      kesehatan_baterai: form.kesehatan_baterai === "" ? null : Number(form.kesehatan_baterai),
    };
    delete payload.id;
    delete payload.total_modal;
    delete payload.estimasi_laba_kotor;
    delete payload.tanggal_input;
    delete payload.tanggal_input_fmt;

    setSaving(true);
    try {
      if (isEdit) {
        await api.patch(`/inventory/${id}`, payload);
        toast.success("Unit berhasil diperbarui");
      } else {
        await api.post("/inventory", payload);
        toast.success("Unit berhasil ditambahkan");
      }
      nav("/admin/inventaris");
    } catch (e) {
      setErr(formatApiErrorDetail(e?.response?.data?.detail) || e.message);
    } finally {
      setSaving(false);
    }
  };

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
  const resolveUrl = (u) => (u?.startsWith("http") ? u : `${BACKEND_URL}${u}`);

  return (
    <div className="space-y-5" data-testid="inventory-form-page">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/admin/inventaris"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
          <div>
            <h1 className="font-heading text-2xl md:text-3xl font-bold tracking-tight">{isEdit ? "Edit Unit" : "Tambah Unit HP"}</h1>
            <p className="text-slate-500 text-sm">Lengkapi data unit, scan IMEI, dan unggah foto/video.</p>
          </div>
        </div>
      </div>

      {err && <p className="text-rose-600 text-sm" data-testid="form-error">{err}</p>}

      <form className="grid grid-cols-1 lg:grid-cols-3 gap-5" onSubmit={onSubmit}>
        {/* Kolom kiri: data produk */}
        <div className="lg:col-span-2 space-y-5">
          <Card className="p-5">
            <h2 className="font-heading font-semibold text-lg mb-4">Identitas Produk</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><Label>Merek *</Label><Input required value={form.merek} onChange={(e) => setField("merek", e.target.value)} placeholder="Samsung, Apple, Xiaomi..." data-testid="f-merek" /></div>
              <div><Label>Model / Tipe *</Label><Input required value={form.model} onChange={(e) => setField("model", e.target.value)} placeholder="Galaxy S23, iPhone 14 Pro..." data-testid="f-model" /></div>
              <div><Label>Varian</Label><Input value={form.varian} onChange={(e) => setField("varian", e.target.value)} placeholder="Ultra / Plus / Standard" data-testid="f-varian" /></div>
              <div><Label>Warna</Label><Input value={form.warna} onChange={(e) => setField("warna", e.target.value)} data-testid="f-warna" /></div>
              <div><Label>RAM</Label><Input value={form.ram} onChange={(e) => setField("ram", e.target.value)} placeholder="8GB" data-testid="f-ram" /></div>
              <div><Label>Penyimpanan</Label><Input value={form.penyimpanan} onChange={(e) => setField("penyimpanan", e.target.value)} placeholder="256GB" data-testid="f-penyimpanan" /></div>
              <div>
                <Label>Jenis Perangkat</Label>
                <Select value={form.jenis_perangkat} onValueChange={(v) => setField("jenis_perangkat", v)}>
                  <SelectTrigger data-testid="f-jenis"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INTER">INTER</SelectItem>
                    <SelectItem value="RESMI">RESMI</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Kondisi</Label>
                <Select value={form.kondisi} onValueChange={(v) => setField("kondisi", v)}>
                  <SelectTrigger data-testid="f-kondisi"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BARU">BARU</SelectItem>
                    <SelectItem value="BEKAS">BEKAS</SelectItem>
                    <SelectItem value="REFURBISHED">REFURBISHED</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Grade Fisik</Label><Input value={form.grade_fisik} onChange={(e) => setField("grade_fisik", e.target.value)} placeholder="A / B / C" data-testid="f-grade" /></div>
              <div><Label>Kesehatan Baterai (%)</Label><Input type="number" min="0" max="100" value={form.kesehatan_baterai} onChange={(e) => setField("kesehatan_baterai", e.target.value)} data-testid="f-baterai" /></div>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="font-heading font-semibold text-lg mb-4">Identitas Unit (IMEI / SN)</h2>
            <div className="space-y-4">
              <div>
                <Label>IMEI 1 *</Label>
                <div className="flex gap-2">
                  <Input
                    required inputMode="numeric" value={form.imei_1}
                    onChange={(e) => setField("imei_1", e.target.value.replace(/\D/g, ""))}
                    onBlur={() => form.imei_1 && checkImei("imei_1")}
                    className="font-mono-tabular" placeholder="15 digit" data-testid="f-imei1"
                  />
                  <Button type="button" variant="outline" onClick={() => openScanner("imei_1")} data-testid="btn-scan-imei1">
                    <ScanLine className="w-4 h-4 mr-1.5" /> Scan
                  </Button>
                </div>
                {imeiCheck1.message && (
                  <p className={`text-xs mt-1 ${imeiCheck1.ok ? "text-emerald-600" : "text-rose-600"}`} data-testid="imei1-feedback">
                    {imeiCheck1.message}
                  </p>
                )}
              </div>
              <div>
                <Label>IMEI 2 (opsional)</Label>
                <div className="flex gap-2">
                  <Input
                    inputMode="numeric" value={form.imei_2}
                    onChange={(e) => setField("imei_2", e.target.value.replace(/\D/g, ""))}
                    onBlur={() => form.imei_2 && checkImei("imei_2")}
                    className="font-mono-tabular" placeholder="Jika dual SIM" data-testid="f-imei2"
                  />
                  <Button type="button" variant="outline" onClick={() => openScanner("imei_2")} data-testid="btn-scan-imei2">
                    <ScanLine className="w-4 h-4 mr-1.5" /> Scan
                  </Button>
                </div>
                {imeiCheck2.message && (
                  <p className={`text-xs mt-1 ${imeiCheck2.ok ? "text-emerald-600" : "text-rose-600"}`} data-testid="imei2-feedback">
                    {imeiCheck2.message}
                  </p>
                )}
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div><Label>Serial Number</Label><Input value={form.serial_number} onChange={(e) => setField("serial_number", e.target.value)} className="font-mono-tabular" data-testid="f-sn" /></div>
                <div><Label>Garansi</Label><Input value={form.garansi} onChange={(e) => setField("garansi", e.target.value)} placeholder="Resmi 12 bulan / Toko 7 hari" data-testid="f-garansi" /></div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div><Label>Kelengkapan</Label><Input value={form.kelengkapan} onChange={(e) => setField("kelengkapan", e.target.value)} placeholder="Fullset / Unit only" data-testid="f-kelengkapan" /></div>
                <div><Label>Supplier</Label><Input value={form.supplier} onChange={(e) => setField("supplier", e.target.value)} data-testid="f-supplier" /></div>
              </div>
              <div><Label>Catatan Pemeriksaan</Label><Textarea rows={3} value={form.catatan_pemeriksaan} onChange={(e) => setField("catatan_pemeriksaan", e.target.value)} data-testid="f-catatan" /></div>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="font-heading font-semibold text-lg mb-4">Media (Foto & Video)</h2>
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Label>Foto Produk</Label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer text-sm text-[#0052FF] hover:underline">
                    <Upload className="w-4 h-4" /> Pilih foto
                    <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => onFile(e, "image")} data-testid="input-upload-image" />
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer text-sm text-slate-600 hover:underline">
                    <Camera className="w-4 h-4" /> Kamera
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFile(e, "image")} data-testid="input-camera-image" />
                  </label>
                  {uploadingImg && <span className="text-xs text-slate-500">Mengunggah...</span>}
                </div>
                <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                  {(form.foto_urls || []).map((u) => (
                    <div key={u} className="relative group aspect-square rounded-md overflow-hidden bg-slate-100">
                      <img src={resolveUrl(u)} alt="" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => removeMedia("image", u)} className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity" data-testid={`btn-remove-foto`}>
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Label>Video Produk</Label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer text-sm text-[#0052FF] hover:underline">
                    <Upload className="w-4 h-4" /> Pilih video
                    <input type="file" accept="video/*" multiple className="hidden" onChange={(e) => onFile(e, "video")} data-testid="input-upload-video" />
                  </label>
                  {uploadingVid && <span className="text-xs text-slate-500">Mengunggah...</span>}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {(form.video_urls || []).map((u) => (
                    <div key={u} className="relative group rounded-md overflow-hidden bg-slate-100">
                      <video src={resolveUrl(u)} controls className="w-full h-32 object-cover" />
                      <button type="button" onClick={() => removeMedia("video", u)} className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="font-heading font-semibold text-lg mb-4">Deskripsi Produk</h2>
            <Textarea rows={5} value={form.deskripsi} onChange={(e) => setField("deskripsi", e.target.value)} placeholder="Deskripsi untuk tampilan toko online..." data-testid="f-deskripsi" />
          </Card>
        </div>

        {/* Kolom kanan: keuangan + status */}
        <div className="space-y-5">
          <Card className="p-5">
            <h2 className="font-heading font-semibold text-lg mb-4">Keuangan</h2>
            <div className="space-y-3">
              {["harga_beli","biaya_reparasi","biaya_tambahan","harga_jual"].map((k) => (
                <div key={k}>
                  <Label>{k === "harga_beli" ? "Harga Beli (Modal)" : k === "biaya_reparasi" ? "Biaya Reparasi/Servis" : k === "biaya_tambahan" ? "Biaya Tambahan" : "Harga Jual Rencana"}</Label>
                  <Input
                    inputMode="numeric"
                    value={form[k] ? Number(form[k]).toLocaleString("id-ID") : ""}
                    onChange={(e) => setField(k, parseRupiahInput(e.target.value))}
                    placeholder="0"
                    className="font-mono-tabular"
                    data-testid={`f-${k}`}
                  />
                </div>
              ))}
              <div className="pt-3 mt-3 border-t space-y-2">
                <div className="flex justify-between text-sm"><span className="text-slate-500">Total Modal</span><span className="font-mono-tabular font-medium">{formatRupiah(totalModal)}</span></div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Estimasi Laba Kotor</span>
                  <span className={`font-mono-tabular font-semibold ${estimasiLaba >= 0 ? "text-emerald-600" : "text-rose-600"}`} data-testid="estimasi-laba">
                    {formatRupiah(estimasiLaba)}
                  </span>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="font-heading font-semibold text-lg mb-4">Status</h2>
            <div className="space-y-3">
              <div>
                <Label>Status Stok</Label>
                <Select value={form.status_stok} onValueChange={(v) => setField("status_stok", v)}>
                  <SelectTrigger data-testid="f-status-stok"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["TERSEDIA","HOLD","TERJUAL","SERVIS","DIARSIPKAN"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {form.status_stok === "HOLD" && (
                <div>
                  <Label>Alasan HOLD</Label>
                  <Input value={form.alasan_hold || ""} onChange={(e) => setField("alasan_hold", e.target.value)} data-testid="f-alasan-hold" />
                </div>
              )}
              <div>
                <Label>Status Publikasi</Label>
                <Select value={form.status_publikasi} onValueChange={(v) => setField("status_publikasi", v)}>
                  <SelectTrigger data-testid="f-status-pub"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["DRAFT","TAYANG","DISEMBUNYIKAN","DIARSIPKAN"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="unggulan">Produk Unggulan</Label>
                <Switch id="unggulan" checked={!!form.produk_unggulan} onCheckedChange={(v) => setField("produk_unggulan", v)} data-testid="f-unggulan" />
              </div>
            </div>
          </Card>

          <Button type="submit" className="w-full bg-[#0052FF] hover:bg-[#0040CC]" disabled={saving} data-testid="btn-submit-unit">
            {saving ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Simpan Unit"}
          </Button>
        </div>
      </form>

      <ImeiScanner
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onCapture={(imei) => {
          setField(scanTarget, imei);
          setTimeout(() => checkImei(scanTarget), 100);
        }}
      />
    </div>
  );
}
