import { Link } from "react-router-dom";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatRupiah } from "@/lib/format";
import { ShoppingBag, Trash2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const resolveUrl = (u) => (!u ? null : u.startsWith("http") ? u : `${BACKEND_URL}${u}`);

export default function KeranjangPage() {
  const { user } = useAuth();
  const { cart, removeItem, clear } = useCart();

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-5 py-14 text-center" data-testid="cart-login-needed">
        <ShoppingBag className="w-10 h-10 mx-auto text-slate-400 mb-3" />
        <h1 className="font-heading font-bold text-2xl">Masuk untuk melihat keranjang</h1>
        <p className="text-slate-500 mt-1">Daftar atau masuk sebagai pelanggan untuk mulai berbelanja.</p>
        <div className="mt-5 flex items-center justify-center gap-3">
          <Link to="/masuk?redirect=/keranjang"><Button data-testid="btn-cart-login">Masuk</Button></Link>
          <Link to="/daftar"><Button variant="outline" data-testid="btn-cart-register">Daftar</Button></Link>
        </div>
      </div>
    );
  }

  if (user.role !== "pelanggan") {
    return (
      <div className="max-w-3xl mx-auto px-5 py-14 text-center">
        <p className="text-slate-500">Akun admin tidak memiliki keranjang. Keluar dan masuk sebagai pelanggan.</p>
      </div>
    );
  }

  const removeHandler = async (unit_id) => {
    const res = await removeItem(unit_id);
    if (res.ok) toast.success("Item dihapus");
    else toast.error(res.message || "Gagal");
  };

  return (
    <div className="max-w-6xl mx-auto px-5 py-8" data-testid="keranjang-page">
      <h1 className="font-heading font-bold text-3xl md:text-4xl">Keranjang</h1>
      <p className="text-slate-500 text-sm mb-6">{cart.jumlah_item} item dalam keranjang Anda</p>

      {cart.items.length === 0 ? (
        <div className="text-center text-slate-500 py-16 bg-slate-50 border border-slate-100 rounded-xl" data-testid="cart-empty">
          <ShoppingBag className="w-10 h-10 mx-auto mb-3 text-slate-400" />
          Keranjang Anda kosong.
          <div className="mt-4">
            <Link to="/katalog"><Button data-testid="btn-ke-katalog">Lihat Katalog</Button></Link>
          </div>
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-5">
          <div className="md:col-span-2 space-y-3">
            {cart.items.map((it) => {
              const img = resolveUrl(it.foto_utama);
              return (
                <Card key={it.unit_id} className="p-4 flex gap-4" data-testid={`cart-item-${it.unit_id}`}>
                  <Link to={`/produk/${it.unit_id}`} className="w-24 h-24 flex-shrink-0 rounded-md overflow-hidden bg-slate-100">
                    {img ? <img src={img} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">—</div>}
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link to={`/produk/${it.unit_id}`} className="font-heading font-semibold hover:text-[#0052FF]">
                      {it.merek} {it.model}
                    </Link>
                    <p className="text-xs text-slate-500">{[it.varian, it.warna].filter(Boolean).join(" · ")}</p>
                    {!it.tersedia && <p className="text-xs text-rose-600 mt-1">Produk tidak tersedia lagi</p>}
                    <div className="mt-2 flex items-center justify-between">
                      <span className="font-mono-tabular font-semibold">{formatRupiah(it.harga_jual)}</span>
                      <Button size="icon" variant="ghost" onClick={() => removeHandler(it.unit_id)} data-testid={`btn-remove-${it.unit_id}`}>
                        <Trash2 className="w-4 h-4 text-rose-600" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={clear} data-testid="btn-clear-cart">Kosongkan keranjang</Button>
            </div>
          </div>

          <Card className="p-5 h-fit sticky top-20">
            <h2 className="font-heading font-semibold mb-3">Ringkasan</h2>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-slate-500">Jumlah item</span>
              <span className="font-mono-tabular">{cart.jumlah_item}</span>
            </div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-slate-500">Subtotal</span>
              <span className="font-mono-tabular" data-testid="cart-subtotal">{formatRupiah(cart.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm mb-4 text-slate-400">
              <span>Ongkir</span>
              <span>Dihitung di checkout</span>
            </div>
            <div className="pt-3 border-t flex justify-between font-semibold">
              <span>Perkiraan Total</span>
              <span className="font-mono-tabular">{formatRupiah(cart.subtotal)}</span>
            </div>
            <Link to="/checkout" className="block">
              <Button className="w-full mt-4 bg-[#0052FF] hover:bg-[#0040CC]" data-testid="btn-checkout" disabled={cart.items.length === 0}>
                Lanjut ke Checkout
              </Button>
            </Link>
            <p className="text-[11px] text-slate-500 mt-3 inline-flex items-start gap-1">
              <ShieldCheck className="w-3 h-3 mt-0.5" />
              Stok akan di-reserve selama 30 menit setelah checkout.
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}
