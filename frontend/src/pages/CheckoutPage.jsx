import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { useSettings } from "@/lib/settings";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { formatRupiah } from "@/lib/format";
import { ArrowLeft, MapPin, Truck, Wallet } from "lucide-react";

export default function CheckoutPage() {
  const { user } = useAuth();
  const { cart, refresh } = useCart();
  const { settings } = useSettings();
  const nav = useNavigate();

  const [addresses, setAddresses] = useState([]);
  const [addrId, setAddrId] = useState("");
  const [kirim, setKirim] = useState("");
  const [bayar, setBayar] = useState("");
  const [catatan, setCatatan] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!user) { nav("/masuk?redirect=/checkout"); return; }
    if (user.role !== "pelanggan") { nav("/"); return; }
    api.get("/customer/addresses").then((r) => {
      setAddresses(r.data);
      const def = r.data.find((a) => a.is_default) || r.data[0];
      if (def) setAddrId(def.id);
    }).finally(() => setLoading(false));
  }, [user, nav]);

  useEffect(() => {
    if (settings?.pengiriman_aktif?.length && !kirim) setKirim(settings.pengiriman_aktif[0].kode);
    if (settings?.pembayaran_aktif?.length && !bayar) setBayar(settings.pembayaran_aktif[0].kode);
  }, [settings, kirim, bayar]);

  const pengirimanObj = settings?.pengiriman_aktif?.find((m) => m.kode === kirim);
  const biayaKirim = pengirimanObj?.default_biaya || 0;
  const total = (cart.subtotal || 0) + biayaKirim;

  const submit = async () => {
    setErr("");
    if (!addrId) return setErr("Pilih alamat pengiriman");
    if (!kirim) return setErr("Pilih metode pengiriman");
    if (!bayar) return setErr("Pilih metode pembayaran");
    if (cart.items.length === 0) return setErr("Keranjang kosong");
    setSubmitting(true);
    try {
      const { data } = await api.post("/orders/checkout", {
        address_id: addrId,
        metode_pengiriman_kode: kirim,
        metode_pembayaran_kode: bayar,
        catatan_pelanggan: catatan,
      });
      await refresh();
      toast.success(`Pesanan ${data.nomor_pesanan} dibuat`);
      nav(`/pesanan/${data.id}`);
    } catch (e) {
      setErr(formatApiErrorDetail(e?.response?.data?.detail) || e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="max-w-6xl mx-auto p-10 text-slate-500">Memuat...</div>;
  if (cart.items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto p-10 text-center" data-testid="checkout-empty">
        <p className="text-slate-500">Keranjang Anda kosong.</p>
        <Link to="/katalog"><Button className="mt-4">Lihat Katalog</Button></Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-5 py-8" data-testid="checkout-page">
      <Link to="/keranjang" className="inline-flex items-center text-sm text-slate-500 hover:text-slate-900 mb-4">
        <ArrowLeft className="w-4 h-4 mr-1.5" /> Kembali ke keranjang
      </Link>
      <h1 className="font-heading font-bold text-3xl md:text-4xl mb-6">Checkout</h1>

      <div className="grid md:grid-cols-3 gap-5">
        <div className="md:col-span-2 space-y-5">
          <Card className="p-5">
            <h2 className="font-heading font-semibold flex items-center gap-2 mb-3"><MapPin className="w-4 h-4 text-[#0052FF]" /> Alamat Pengiriman</h2>
            {addresses.length === 0 ? (
              <div className="text-sm text-slate-500">
                Belum ada alamat. <Link to="/akun" className="text-[#0052FF] underline">Tambah di halaman akun</Link>.
              </div>
            ) : (
              <RadioGroup value={addrId} onValueChange={setAddrId} data-testid="checkout-address-group">
                <div className="space-y-2">
                  {addresses.map((a) => (
                    <label key={a.id} className="flex items-start gap-3 p-3 border border-slate-200 rounded-md cursor-pointer hover:bg-slate-50" data-testid={`checkout-addr-${a.id}`}>
                      <RadioGroupItem value={a.id} id={`addr-${a.id}`} className="mt-1" />
                      <div className="flex-1">
                        <p className="font-medium">{a.nama_penerima} <span className="text-slate-400 font-normal">· {a.telepon_penerima}</span></p>
                        <p className="text-sm text-slate-600">{a.alamat_lengkap}</p>
                        <p className="text-xs text-slate-500">{[a.kelurahan, a.kecamatan, a.kabupaten, a.provinsi, a.kode_pos].filter(Boolean).join(", ")}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </RadioGroup>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="font-heading font-semibold flex items-center gap-2 mb-3"><Truck className="w-4 h-4 text-[#0052FF]" /> Metode Pengiriman</h2>
            <RadioGroup value={kirim} onValueChange={setKirim} data-testid="checkout-ship-group">
              <div className="space-y-2">
                {(settings?.pengiriman_aktif || []).map((m) => (
                  <label key={m.kode} className="flex items-center gap-3 p-3 border border-slate-200 rounded-md cursor-pointer hover:bg-slate-50" data-testid={`ship-${m.kode}`}>
                    <RadioGroupItem value={m.kode} id={`ship-${m.kode}`} />
                    <div className="flex-1">
                      <p className="font-medium">{m.nama}</p>
                      {m.butuh_konfirmasi && <p className="text-xs text-amber-700">Ongkir final akan dikonfirmasi admin</p>}
                      {m.deskripsi && <p className="text-xs text-slate-500">{m.deskripsi}</p>}
                    </div>
                    <span className="font-mono-tabular text-sm">{formatRupiah(m.default_biaya)}</span>
                  </label>
                ))}
              </div>
            </RadioGroup>
          </Card>

          <Card className="p-5">
            <h2 className="font-heading font-semibold flex items-center gap-2 mb-3"><Wallet className="w-4 h-4 text-[#0052FF]" /> Metode Pembayaran</h2>
            <RadioGroup value={bayar} onValueChange={setBayar} data-testid="checkout-pay-group">
              <div className="space-y-2">
                {(settings?.pembayaran_aktif || []).map((m) => (
                  <label key={m.kode} className="flex items-start gap-3 p-3 border border-slate-200 rounded-md cursor-pointer hover:bg-slate-50" data-testid={`pay-${m.kode}`}>
                    <RadioGroupItem value={m.kode} id={`pay-${m.kode}`} className="mt-1" />
                    <div className="flex-1">
                      <p className="font-medium">{m.nama}</p>
                      {m.deskripsi && <p className="text-xs text-slate-500">{m.deskripsi}</p>}
                      {m.kode === "transfer_bank" && (m.rekening || []).length > 0 && (
                        <ul className="text-xs text-slate-600 mt-1">
                          {m.rekening.map((r, i) => <li key={i}>{r.bank} · <span className="font-mono-tabular">{r.nomor}</span> · a/n {r.atas_nama}</li>)}
                        </ul>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </RadioGroup>
          </Card>

          <Card className="p-5">
            <Label>Catatan untuk toko (opsional)</Label>
            <Textarea rows={3} value={catatan} onChange={(e) => setCatatan(e.target.value)} data-testid="checkout-catatan" />
          </Card>
        </div>

        <Card className="p-5 h-fit sticky top-20">
          <h2 className="font-heading font-semibold mb-3">Ringkasan Pesanan</h2>
          <div className="space-y-2 max-h-56 overflow-y-auto border-b pb-3 mb-3">
            {cart.items.map((it) => (
              <div key={it.unit_id} className="flex justify-between text-sm">
                <span className="truncate pr-2">{it.merek} {it.model}</span>
                <span className="font-mono-tabular whitespace-nowrap">{formatRupiah(it.harga_jual)}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-sm"><span className="text-slate-500">Subtotal</span><span className="font-mono-tabular">{formatRupiah(cart.subtotal)}</span></div>
          <div className="flex justify-between text-sm mt-1"><span className="text-slate-500">Biaya kirim</span><span className="font-mono-tabular">{formatRupiah(biayaKirim)}</span></div>
          <div className="flex justify-between font-semibold text-lg mt-3 pt-3 border-t">
            <span>Total</span>
            <span className="font-mono-tabular" data-testid="checkout-total">{formatRupiah(total)}</span>
          </div>
          {err && <p className="text-sm text-rose-600 mt-3" data-testid="checkout-error">{err}</p>}
          <Button className="w-full mt-4 bg-[#0052FF] hover:bg-[#0040CC]" onClick={submit} disabled={submitting} data-testid="btn-place-order">
            {submitting ? "Memproses..." : "Buat Pesanan"}
          </Button>
          <p className="text-[11px] text-slate-500 mt-3">Stok akan di-reserve selama 30 menit untuk pembayaran.</p>
        </Card>
      </div>
    </div>
  );
}
