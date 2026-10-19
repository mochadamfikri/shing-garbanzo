import React, { useState, useRef } from "react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Camera,
  Upload,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  X,
  ScanLine,
  RefreshCw,
  Layers,
  ArrowRight
} from "lucide-react";
import { toast } from "sonner";

export default function SmartScannerModal({ isOpen, onClose, onScanComplete }) {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const galleryInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    
    setSelectedFiles((prev) => [...prev, ...files]);
    files.forEach((f) => {
      const url = URL.createObjectURL(f);
      setPreviews((prev) => [...prev, url]);
    });
  };

  const removeFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const processScan = async () => {
    if (!selectedFiles.length) {
      toast.warning("Pilih minimal satu foto label box atau screenshot");
      return;
    }

    setLoading(true);
    setExtractedData(null);

    try {
      const formData = new FormData();
      selectedFiles.forEach((file) => {
        formData.append("files", file);
      });

      const { data } = await api.post("/scan/device-info/multi", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      if (data.success && data.fields && Object.keys(data.fields).length > 0) {
        setExtractedData(data);
        toast.success(`Berhasil mendeteksi ${Object.keys(data.fields).length} informasi perangkat!`);
      } else {
        toast.warning("Teks atau barcode belum terbaca jelas. Coba foto dengan sudut tegak lurus dan pencahayaan cukup.");
      }
    } catch (e) {
      toast.error(formatApiErrorDetail(e?.response?.data?.detail) || "Gagal memproses gambar");
    } finally {
      setLoading(false);
    }
  };

  const applyToForm = () => {
    if (extractedData?.fields) {
      onScanComplete(extractedData.fields);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-sm">
      <div 
        className="w-full sm:max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[85vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
              <ScanLine className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-base text-slate-900 dark:text-white leading-tight">
                Smart Device Scanner
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Pindai Label Box Perangkat atau Screenshot Pengaturan Mengenai
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {/* Action Trigger Buttons for Mobile */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="p-4 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 flex flex-col items-center justify-center gap-2 hover:bg-blue-100 transition-colors"
            >
              <Camera className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <span className="text-xs font-bold">Ambil Foto Kamera</span>
            </button>
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 flex flex-col items-center justify-center gap-2 hover:bg-slate-100 transition-colors"
            >
              <Upload className="w-6 h-6 text-slate-600 dark:text-slate-400" />
              <span className="text-xs font-bold">Upload dari Galeri</span>
            </button>
          </div>

          {/* Hidden Inputs */}
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Selected Previews */}
          {previews.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Foto Terpilih ({previews.length})
                </span>
                <button
                  type="button"
                  onClick={() => { setSelectedFiles([]); setPreviews([]); setExtractedData(null); }}
                  className="text-xs text-rose-500 hover:underline"
                >
                  Hapus Semua
                </button>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                {previews.map((src, idx) => (
                  <div key={idx} className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 aspect-square">
                    <img src={src} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded-full hover:bg-rose-600 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <Button
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-11 shadow-md shadow-blue-500/20"
                onClick={processScan}
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" /> Sedang Mengekstrak Data Perangkat...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4" /> Proses OCR & Barcode
                  </span>
                )}
              </Button>
            </div>
          )}

          {/* Extracted Data Result Card */}
          {extractedData?.fields && Object.keys(extractedData.fields).length > 0 && (
            <Card className="p-4 border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="font-heading font-bold text-sm text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Hasil Ekstraksi
                </span>
                <span className="text-[11px] text-emerald-600 font-semibold font-mono">
                  {Object.keys(extractedData.fields).length} Field Terdeteksi
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                {Object.entries(extractedData.fields).map(([k, v]) => (
                  <div key={k} className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-950/60">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">{k.replace("_", " ")}</span>
                    <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 truncate block mt-0.5">
                      {String(v)}
                    </span>
                  </div>
                ))}
              </div>

              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-11 shadow-md shadow-emerald-500/20"
                onClick={applyToForm}
              >
                Gunakan Data Ini ke Formulir <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
