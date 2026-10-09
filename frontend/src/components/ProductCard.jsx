import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatRupiah } from "@/lib/format";
import { ShieldCheck } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const resolveUrl = (u) => (!u ? null : u.startsWith("http") ? u : `${BACKEND_URL}${u}`);

export default function ProductCard({ item }) {
  const img = resolveUrl((item.foto_urls || [])[0]);
  return (
    <Card className="group overflow-hidden flex flex-col transition-shadow hover:shadow-md" data-testid={`product-card-${item.id}`}>
      <Link to={`/produk/${item.id}`} className="block">
        <div className="aspect-square bg-slate-100 overflow-hidden">
          {img ? (
            <img src={img} alt={`${item.merek} ${item.model}`} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">Tanpa foto</div>
          )}
        </div>
      </Link>
      <div className="p-4 flex flex-col gap-2 flex-1">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Badge variant="outline" className="text-[10px] uppercase tracking-wider">{item.kondisi}</Badge>
          <span>·</span><span>{item.jenis_perangkat}</span>
          {item.produk_unggulan && <Badge className="bg-[#FF5722] text-white hover:bg-[#FF5722] ml-auto">Unggulan</Badge>}
        </div>
        <Link to={`/produk/${item.id}`} className="font-heading font-semibold text-base leading-tight hover:text-[#0052FF] transition-colors">
          {item.merek} {item.model}
        </Link>
        <p className="text-xs text-slate-500">{[item.ram, item.penyimpanan, item.warna].filter(Boolean).join(" · ") || "-"}</p>
        <div className="mt-auto pt-2 flex items-center justify-between">
          <span className="font-mono-tabular font-bold text-lg">{formatRupiah(item.harga_jual)}</span>
          <Link to={`/produk/${item.id}`}>
            <Button size="sm" variant="outline" data-testid={`btn-lihat-${item.id}`}>Lihat</Button>
          </Link>
        </div>
        {item.garansi && (
          <p className="text-[11px] text-emerald-700 inline-flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> {item.garansi}</p>
        )}
      </div>
    </Card>
  );
}
