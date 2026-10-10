import { useState } from "react";
import { Link } from "react-router-dom";
import { api, formatApiErrorDetail } from "@/lib/api";
import { formatRupiah } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import ImeiScanner from "@/components/ImeiScanner";
import { toast } from "sonner";
import { ScanLine, Plus, Trash2, ShoppingCart } from "lucide-react";

export default function PosPage() {
  const [imei, setImei] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [missing, setMissing] = useState("");
  const [method, setMethod] = useState("TUNAI");
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState(null);
  const [transactionKey, setTransactionKey] = useState(() => crypto.randomUUID());
  const lookup = async (value = imei) => {
    const code = String(value || "").trim();
    if (!/^\d{15}$/.test(code)) return toast.error("IMEI harus 15 angka");
    setLoading(true); setMissing("");
    try {
      const {data} = await api.get("/pos/lookup", {params:{imei:code}});
      if (!data.ditemukan) { setMissing(code); toast.warning(data.pesan); return; }
      if (!data.boleh_dijual) return toast.warning(data.pesan);
      if (items.some(x => x.id === data.unit.id)) return toast.warning("Unit sudah ada di keranjang");
      setItems(prev=>[...prev,{...data.unit,diskon:0}]); setImei("");
      toast.success("Produk ditambahkan ke penjualan");
    } catch(e) { toast.error(formatApiErrorDetail(e?.response?.data?.detail)||"Gagal mencari IMEI"); }
    finally {setLoading(false);}
  };
  const subtotal = items.reduce((n,x)=>n+Number(x.harga_jual||0),0);
  const diskon = items.reduce((n,x)=>n+Number(x.diskon||0),0);
  const submit = async () => {
    if(!items.length || busy) return;
    if(!window.confirm("Konfirmasi pembayaran telah diterima dan selesaikan penjualan?")) return;
    setBusy(true);
    try {
      const {data} = await api.post("/pos/sales",{
        items:items.map(x=>({unit_id:x.id,diskon:Number(x.diskon||0)})),
        metode_pembayaran:method,pembayaran_terverifikasi:true,
        biaya_transaksi:0,idempotency_key:transactionKey
      });
      setLast(data);setItems([]);setTransactionKey(crypto.randomUUID());
      toast.success("Penjualan berhasil disimpan, stok otomatis TERJUAL");
    }catch(e){toast.error(formatApiErrorDetail(e?.response?.data?.detail)||"Transaksi gagal");}
    finally{setBusy(false);}
  };
  return <div className="space-y-5 max-w-4xl mx-auto pb-5" data-testid="pos-page">
    <div><h1 className="text-2xl md:text-3xl font-bold">Kasir / Penjualan</h1><p className="text-slate-500 text-sm">Scan IMEI, periksa stok dan catat transaksi toko fisik.</p></div>
    <Card className="p-4 space-y-3">
      <div className="flex gap-2"><Input inputMode="numeric" placeholder="Masukkan atau scan IMEI" aria-label="IMEI untuk dijual" value={imei} onChange={e=>setImei(e.target.value.replace(/\D/g,""))} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();lookup();}}}/><Button type="button" variant="outline" onClick={()=>setScannerOpen(true)} aria-label="Scan kamera"><ScanLine className="h-5 w-5"/></Button></div>
      <Button className="w-full min-h-11" onClick={()=>lookup()} disabled={loading}>{loading?"Mencari...":"Cari dan Tambahkan Produk"}</Button>
      {missing && <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm"><p>IMEI belum ada di database, silakan input data dulu.</p><Link className="mt-2 inline-flex font-semibold text-blue-700 underline" to={`/admin/inventaris/baru?imei=${encodeURIComponent(missing)}`}>+ Tambah stok barang</Link></div>}
    </Card>
    <Card className="p-4 space-y-4"><h2 className="font-semibold flex items-center gap-2"><ShoppingCart className="h-5 w-5"/> Keranjang Penjualan ({items.length})</h2>
      {items.length===0?<p className="text-sm text-slate-500">Belum ada produk. Scan IMEI untuk menambahkan unit.</p>:items.map(x=><div key={x.id} className="rounded-lg border p-3 space-y-2"><div className="flex justify-between gap-3"><div><b>{x.merek} {x.model}</b><p className="text-xs text-slate-500">IMEI: {x.imei_1}</p><p className="font-semibold">{formatRupiah(x.harga_jual)}</p></div><Button variant="ghost" size="icon" aria-label="Hapus dari keranjang" onClick={()=>setItems(prev=>prev.filter(t=>t.id!==x.id))}><Trash2 className="h-4 w-4"/></Button></div><label className="block text-xs text-slate-600">Diskon (Rp, jika berizin)<Input type="number" min={0} max={x.harga_jual} value={x.diskon} onChange={e=>setItems(prev=>prev.map(t=>t.id===x.id?{...t,diskon:Math.max(0,Number(e.target.value)||0)}:t))}/></label></div>)}
      <div className="border-t pt-3 space-y-2"><div className="flex justify-between text-sm"><span>Subtotal</span><b>{formatRupiah(subtotal)}</b></div><div className="flex justify-between text-sm"><span>Diskon</span><b>{formatRupiah(diskon)}</b></div><div className="flex justify-between text-lg font-bold"><span>Total</span><span>{formatRupiah(subtotal-diskon)}</span></div></div>
      <label className="block text-sm font-medium">Metode Pembayaran<select className="block w-full mt-1 h-11 rounded-md border px-3" value={method} onChange={e=>setMethod(e.target.value)}><option value="TUNAI">Tunai</option><option value="TRANSFER">Transfer manual (Owner/Admin)</option><option value="QRIS_MANUAL">QRIS manual (Owner/Admin)</option></select></label>
      <Button className="w-full min-h-12" disabled={busy||!items.length||diskon>subtotal} onClick={submit}>{busy?"Menyimpan...":"Konfirmasi Pembayaran & Selesaikan"}</Button>
    </Card>
    {last&&<Card className="p-4 border-emerald-300 bg-emerald-50" role="status"><b>Penjualan berhasil!</b><p>{last.nomor_transaksi}</p><p>Total: {formatRupiah(last.penjualan_bersih)}</p><p className="text-sm">Status unit: TERJUAL</p></Card>}
    <ImeiScanner open={scannerOpen} onOpenChange={setScannerOpen} onCapture={v=>{setImei(v);lookup(v);}}/>
  </div>;
}
