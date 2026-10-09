import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { api, formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { formatRupiah } from "@/lib/format";
import { ShoppingBag, ShieldCheck, ArrowLeft, Check, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const resolveUrl = (u) => (!u ? null : u.startsWith("http") ? u : `${BACKEND_URL}${u}`);

export default function ProdukDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { addItem } = useCart();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [activeImg, setActiveImg] = useState(0);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    api.get(`/catalog/${id}`)
      .then((r) => setData(r.data))
      .catch((e) => setErr(formatApiErrorDetail(e?.response?.data?.detail) || e.message));
  }, [id]);

  const handleAddCart = async () => {
    if (!user) {
      toast.info("Silakan masuk sebagai pelanggan untuk menambahkan ke keranjang");
      nav(`/masuk?redirect=/produk/${id}`);
      return;
    }
    if (user.role !== "pelanggan") {
      toast.warning("Akun admin tidak dapat menambahkan ke keranjang");
      return;
    }
    setAdding(true);
    const res = await addItem(id);
    setAdding(false);
    if (res.ok) toast.success("Berhasil ditambahkan ke keranjang");
    else toast.error(res.message || "Gagal menambah");
  };

  if (err) return <div className="max-w-6xl mx-auto p-10 text-rose-600">{err}</div>;
  if (!data) return <div className="max-w-6xl mx-auto p-10 text-slate-500">Memuat...</div>;

  const fotos = (data.foto_urls || []).map(resolveUrl).filter(Boolean);
  const videos = (data.video_urls || []).map(resolveUrl).filter(Boolean);

  return (
    <div className="max-w-6xl mx-auto px-5 py-6" data-testid="produk-detail-page">
      <Link to="/katalog" className="inline-flex items-center text-sm text-slate-500 hover:text-slate-900 mb-4">
        <ArrowLeft className="w-4 h-4 mr-1.5" /> Kembali ke katalog
      </Link>

      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <div className="aspect-square bg-slate-100 rounded-xl overflow-hidden mb-3">
            {fotos[activeImg] ? (
              <img src={fotos[activeImg]} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">Tanpa foto</div>
            )}
          </div>
          {fotos.length > 1 && (
            <div className="grid grid-cols-5 gap-2">
              {fotos.map((f, i) => (
                <button key={f + i} onClick={() => setActiveImg(i)}
                        className={`aspect-square rounded-md overflow-hidden border-2 ${i === activeImg ? "border-[#0052FF]" : "border-transparent"}`}
                        data-testid={`thumb-${i}`}>
                  <img src={f} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
          {videos.length > 0 && (
            <div className="mt-4 space-y-2">
              {videos.map((v, i) => <video key={v + i} src={v} controls className="w-full rounded-md" />)}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="text-xs">{data.kondisi}</Badge>
            <Badge variant="outline" className="text-xs">{data.jenis_perangkat}</Badge>
            {data.produk_unggulan && <Badge className="bg-[#FF5722] text-white">Unggulan</Badge>}
          </div>
          <h1 className="font-heading font-bold text-3xl md:text-4xl tracking-tight">{data.merek} {data.model}</h1>
          <p className="text-slate-500 mt-1">{[data.varian, data.ram, data.penyimpanan, data.warna].filter(Boolean).join(" · ") || "-"}</p>

          <div className="mt-5 flex items-end gap-3">
            <span className="font-mono-tabular font-bold text-3xl md:text-4xl" data-testid="produk-harga">{formatRupiah(data.harga_jual)}</span>
            {data.tersedia ? (
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 border" data-testid="produk-tersedia">
                <Check className="w-3 h-3 mr-1" /> Tersedia
              </Badge>
            ) : (
              <Badge className="bg-rose-100 text-rose-700 border-rose-200 border" data-testid="produk-habis">
                <X className="w-3 h-3 mr-1" /> Tidak Tersedia
              </Badge>
            )}
          </div>

          <div className="mt-6 flex gap-3">
            <Button
              className="bg-slate-900 hover:bg-slate-800 h-11 flex-1"
              onClick={handleAddCart} disabled={!data.tersedia || adding}
              data-testid="btn-add-to-cart"
            >
              <ShoppingBag className="w-4 h-4 mr-2" />
              {adding ? "Menambahkan..." : "Tambah ke Keranjang"}
            </Button>
          </div>

          <div className="mt-6 space-y-3">
            <h3 className="font-semibold">Spesifikasi</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ["Merek", data.merek], ["Model", data.model], ["Varian", data.varian],
                ["RAM", data.ram], ["Penyimpanan", data.penyimpanan], ["Warna", data.warna],
                ["Jenis Perangkat", data.jenis_perangkat], ["Kondisi", data.kondisi],
                ["Grade", data.grade_fisik], ["Baterai", data.kesehatan_baterai ? `${data.kesehatan_baterai}%` : null],
                ["Kelengkapan", data.kelengkapan], ["Garansi", data.garansi],
              ].filter(([, v]) => v).map(([k, v]) => (
                <div key={k}>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">{k}</p>
                  <p className="text-slate-900">{v}</p>
                </div>
              ))}
            </div>
          </div>

          {data.garansi && (
            <Card className="mt-6 p-4 bg-emerald-50 border-emerald-100">
              <div className="flex items-start gap-2 text-sm text-emerald-800">
                <ShieldCheck className="w-5 h-5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Garansi</p>
                  <p className="text-emerald-700">{data.garansi}</p>
                </div>
              </div>
            </Card>
          )}

          {data.deskripsi && (
            <div className="mt-6">
              <h3 className="font-semibold mb-2">Deskripsi</h3>
              <p className="text-sm text-slate-700 whitespace-pre-line">{data.deskripsi}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
