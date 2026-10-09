import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import ProductCard from "@/components/ProductCard";
import { Search, SlidersHorizontal } from "lucide-react";

export default function KatalogPage() {
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState(params.get("q") || "");
  const [merek, setMerek] = useState(params.get("merek") || "ALL");
  const [kondisi, setKondisi] = useState(params.get("kondisi") || "ALL");
  const [jenis, setJenis] = useState(params.get("jenis") || "ALL");
  const [sort, setSort] = useState(params.get("sort") || "baru");
  const [brands, setBrands] = useState([]);

  const load = async () => {
    setLoading(true);
    const p = {};
    if (q) p.q = q;
    if (merek !== "ALL") p.merek = merek;
    if (kondisi !== "ALL") p.kondisi = kondisi;
    if (jenis !== "ALL") p.jenis_perangkat = jenis;
    if (sort) p.sort = sort;
    try {
      const { data } = await api.get("/catalog", { params: p });
      setItems(data);
    } finally {
      setLoading(false);
    }
    // sync url
    const sp = {};
    if (q) sp.q = q;
    if (merek !== "ALL") sp.merek = merek;
    if (kondisi !== "ALL") sp.kondisi = kondisi;
    if (jenis !== "ALL") sp.jenis = jenis;
    if (sort && sort !== "baru") sp.sort = sort;
    setParams(sp, { replace: true });
  };

  useEffect(() => {
    api.get("/catalog/brands").then((r) => setBrands(r.data)).catch(() => {});
  }, []);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [merek, kondisi, jenis, sort]);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  return (
    <div className="max-w-6xl mx-auto px-5 py-8">
      <div className="mb-6">
        <h1 className="font-heading font-bold text-3xl md:text-4xl">Katalog Produk</h1>
        <p className="text-slate-500 text-sm mt-1">Jelajahi smartphone yang tersedia di toko kami.</p>
      </div>

      <Card className="p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="md:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <Input className="pl-9" placeholder="Cari merek atau model..." value={q}
                   onChange={(e) => setQ(e.target.value)}
                   onKeyDown={(e) => e.key === "Enter" && load()}
                   data-testid="catalog-search" />
          </div>
          <Select value={merek} onValueChange={setMerek}>
            <SelectTrigger data-testid="catalog-filter-merek"><SelectValue placeholder="Merek" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Merek</SelectItem>
              {brands.map((b) => <SelectItem key={b.merek} value={b.merek}>{b.merek}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={kondisi} onValueChange={setKondisi}>
            <SelectTrigger data-testid="catalog-filter-kondisi"><SelectValue placeholder="Kondisi" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Kondisi</SelectItem>
              <SelectItem value="BARU">BARU</SelectItem>
              <SelectItem value="BEKAS">BEKAS</SelectItem>
              <SelectItem value="REFURBISHED">REFURBISHED</SelectItem>
            </SelectContent>
          </Select>
          <Select value={jenis} onValueChange={setJenis}>
            <SelectTrigger data-testid="catalog-filter-jenis"><SelectValue placeholder="Jenis" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Jenis</SelectItem>
              <SelectItem value="INTER">INTER</SelectItem>
              <SelectItem value="RESMI">RESMI</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger data-testid="catalog-sort"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="baru">Terbaru</SelectItem>
              <SelectItem value="harga_naik">Harga Terendah</SelectItem>
              <SelectItem value="harga_turun">Harga Tertinggi</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex justify-end mt-3">
          <Button size="sm" variant="outline" onClick={load} data-testid="btn-apply-catalog-filter">
            <SlidersHorizontal className="w-4 h-4 mr-1.5" /> Terapkan
          </Button>
        </div>
      </Card>

      {loading ? (
        <p className="text-center text-slate-500 py-20">Memuat katalog...</p>
      ) : items.length === 0 ? (
        <div className="text-center text-slate-500 py-20" data-testid="catalog-empty">
          <p>Tidak ada produk yang cocok dengan filter Anda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4" data-testid="catalog-grid">
          {items.map((it) => <ProductCard key={it.id} item={it} />)}
        </div>
      )}
    </div>
  );
}
