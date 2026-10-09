import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Camera, StopCircle, ScanLine } from "lucide-react";
import { validateImeiClient } from "@/lib/luhn";

/**
 * ImeiScanner: Modal untuk scan IMEI via kamera (BarcodeDetector native API).
 * Props:
 *  - open, onOpenChange
 *  - onCapture(imei): dipanggil ketika user menyetujui hasil
 */
export default function ImeiScanner({ open, onOpenChange, onCapture }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const rafRef = useRef(null);
  const [scanning, setScanning] = useState(false);
  const [imei, setImei] = useState("");
  const [error, setError] = useState("");
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    if (!open) {
      stop();
      setImei("");
      setError("");
    } else {
      start();
    }
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const start = async () => {
    setError("");
    if (!("BarcodeDetector" in window)) {
      setSupported(false);
      setError("Browser tidak mendukung Barcode Detector. Gunakan input manual atau scanner eksternal (USB/Bluetooth).");
      return;
    }
    try {
      detectorRef.current = new window.BarcodeDetector({
        formats: ["code_128", "code_39", "ean_13", "qr_code", "itf", "codabar"],
      });
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setScanning(true);
      scanLoop();
    } catch (e) {
      console.error(e);
      setError("Tidak dapat mengakses kamera. Pastikan izin diberikan dan HTTPS.");
    }
  };

  const stop = () => {
    setScanning(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const scanLoop = async () => {
    if (!detectorRef.current || !videoRef.current) return;
    try {
      const codes = await detectorRef.current.detect(videoRef.current);
      if (codes && codes.length > 0) {
        // Pilih kode numerik 14-17 digit (kemungkinan IMEI)
        const numeric = codes
          .map((c) => (c.rawValue || "").replace(/\s/g, ""))
          .filter((v) => /^\d{14,17}$/.test(v));
        const picked = numeric[0] || codes[0].rawValue;
        if (picked) {
          setImei(picked);
          const check = validateImeiClient(picked);
          if (!check.ok) {
            toast.warning(`Terbaca: ${picked} — ${check.message}`);
          } else {
            toast.success(`IMEI terbaca: ${picked}`);
          }
          stop();
          return;
        }
      }
    } catch (e) {
      // ignore and continue
    }
    rafRef.current = requestAnimationFrame(scanLoop);
  };

  const handleConfirm = () => {
    const check = validateImeiClient(imei);
    if (!check.ok) {
      setError(check.message);
      return;
    }
    onCapture?.(imei.trim());
    onOpenChange?.(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="imei-scanner-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="w-5 h-5 text-[#0052FF]" /> Scan IMEI
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
            {supported ? (
              <video ref={videoRef} playsInline muted className="w-full h-full object-cover" data-testid="imei-video" />
            ) : (
              <div className="flex items-center justify-center h-full text-white/80 text-sm p-4 text-center">
                Browser tidak mendukung scan kamera. Gunakan input manual di bawah atau scanner USB.
              </div>
            )}
            {scanning && (
              <div className="absolute inset-x-6 top-1/2 h-0.5 bg-red-500/80 animate-pulse" />
            )}
          </div>

          <div>
            <Label htmlFor="imei-captured">Hasil / Koreksi Manual</Label>
            <Input
              id="imei-captured"
              inputMode="numeric"
              autoComplete="off"
              value={imei}
              onChange={(e) => setImei(e.target.value.replace(/\D/g, ""))}
              placeholder="Masukkan atau koreksi IMEI"
              data-testid="imei-captured-input"
              className="font-mono-tabular"
            />
            {error && <p className="text-sm text-rose-600 mt-1" data-testid="imei-scan-error">{error}</p>}
          </div>
        </div>

        <DialogFooter className="gap-2">
          {scanning ? (
            <Button variant="outline" onClick={stop} data-testid="btn-scan-stop">
              <StopCircle className="w-4 h-4 mr-1.5" /> Hentikan
            </Button>
          ) : (
            <Button variant="outline" onClick={start} data-testid="btn-scan-restart">
              <Camera className="w-4 h-4 mr-1.5" /> Mulai Scan
            </Button>
          )}
          <Button onClick={handleConfirm} data-testid="btn-scan-confirm">Gunakan IMEI</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
