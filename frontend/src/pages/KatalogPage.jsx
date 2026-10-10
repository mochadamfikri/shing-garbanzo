import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, formatApiErrorDetail } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import ProductCard from "@/components/ProductCard";
import { Search, SlidersHorizontal, ChevronDown, ChevronUp, X } from "lucide-react";

const EMPTY_FILTER = {
  q: "", merek: "ALL", kondisi: "ALL", jenis: "ALL", sort: "baru",
};

function filtersFromUrl(params) {
  return {
    q: params.get("q") || "",
    merek: params.get("merek") || "ALL",
    kondisi: params.get("kondisi") || "ALL",
    jenis: params.get("jenis") || "ALL",
    sort: params.get("sort") || "baru",
  };
}

function filterParams(filters) {
  const query = new URLSearchParams();
  if (filters.q.trim()) query.set("q", filters.q.trim());
  if (filters.merek !== "ALL") query.set("merek", filters.merek);
  if (filters.kondisi !== "ALL") query.set("kondisi", filters.kondisi);
  if (filters.jenis !== "ALL") query.set("jenis", filters.jenis);
  if (filters.sort !== "baru") query.set("sort", filters.sort);
  return query;
}

export default function KatalogPage() {
  const [params, setParams] = useSearchParams();
  const paramsKey = params.toString();
  const [draft, setDraft] = useState(() => filtersFromUrl(params));
  const [filterOpen, setFilterOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const activeFilters = filtersFromUrl(params);
  const activeCount = [
    activeFilters.q.trim(), activeFilters.merek !== "ALL",
    activeFilters.kondisi !== "ALL", activeFilters.jenis !== "ALL",
    activeFilters.sort !== "baru",
  ].filter(Boolean).length;

  // URL menjadi sumber filter terpakai; perubahan dropdown hanya disimpan sebagai draft
  // sampai pengguna menekan Terapkan. Ini juga mendukung link katalog berfilter.
  useEffect(() => {
    const applied = filtersFromUrl(new URLSearchParams(paramsKey));
    setDraft(applied);
    const p = {};
    if (applied.q.trim()) p.q = applied.q.trim();
    if (applied.merek !== "ALL") p.merek = applied.merek;
    if (applied.kondisi !== "ALL") p.kondisi = applied.kondisi;
    if (applied.jenis !== "ALL") p.jenis_perangkat = applied.jenis;
    p.sort = applied.sort;

    let cancelled = false;
    setLoading(true);
    setError("");
    api.get("/catalog", { params: p })
      .then(({ data }) => { if (!cancelled) setItems(data); })
      .catch((e) => { if (!cancelled) setError(formatApiErrorDetail(e?.response?.data?.detail) || "Gagal memuat katalog. Silakan coba lagi."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [paramsKey]);

  useEffect(() => {
    api.get("/catalog/brands").then(({ data }) => setBrands(data)).catch(() => {});
  }, []);

  const setField = (key, value) => setDraft((prev) => ({ ...prev, [key]: value }));
  const applyFilters = () => {
    setParams(filterParams(draft), { replace: true });
    setFilterOpen(false);
  };
  const clearFilters = () => {
    setDraft({ ...EMPTY_FILTER });
    setParams({}, { replace: true });
    setFilterOpen(false);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-5 py-6 md:py-8" data-testid="catalog-page">
      <div className="mb-5">
        <h1 className="font-heading font-bold text-3xl md:text-4xl">Katalog Produk</h1>
        <p className="text-slate-500 text-sm mt-1">Jelajahi smartphone yang tersedia di toko kami.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <Button type="button" variant="outline"
          className="min-h-11 w-full sm:w-auto justify-between gap-3"
          onClick={() => setFilterOpen((v) => !v)}
          aria-expanded={filterOpen}
          aria-controls="catalog-filter-panel"
          data-testid="btn-toggle-catalog-filter">
          <span className="inline-flex items-center gap-2">
            <Search className="w-4 h-4" />
            {filterOpen ? "Tutup Pencarian" : "Pencarian & Filter"}
            {activeCount > 0 && <span className="bg-blue-100 text-blue-700 rounded-full px-2 text-xs font-semibold">{activeCount} aktif</span>}
          </span>
          {filterOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </Button>
        {activeCount > 0 && (
          <Button type="button" size="sm" variant="ghost" onClick={clearFilters} data-testid="btn-reset-catalog-filter">
            <X className="w-4 h-4 mr-1" /> Hapus Filter
          </Button>
        )}
      </div>

      {filterOpen && (
        <Card id="catalog-filter-panel" className="p-4 mb-6" data-testid="catalog-filter-panel">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <div className="md:col-span-2 relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <Input className="pl-9" placeholder="Cari merek atau model..." value={draft.q}
                onChange={(e) => setField("q", e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyFilters(); } }}
                data-testid="catalog-search" />
            </div>
            <Select value={draft.merek} onValueChange={(v) => setField("merek", v)}>
              <SelectTrigger data-testid="catalog-filter-merek"><SelectValue placeholder="Merek" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Merek</SelectItem>
                {brands.map((b) => <SelectItem key={b.merek} value={b.merek}>{b.merek}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={draft.kondisi} onValueChange={(v) => setField("kondisi", v)}>
              <SelectTrigger data-testid="catalog-filter-kondisi"><SelectValue placeholder="Kondisi" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Kondisi</SelectItem>
                <SelectItem value="BARU">BARU</SelectItem>
                <SelectItem value="BEKAS">BEKAS</SelectItem>
                <SelectItem value="REFURBISHED">REFURBISHED</SelectItem>
              </SelectContent>
            </Select>
            <Select value={draft.jenis} onValueChange={(v) => setField("jenis", v)}>
              <SelectTrigger data-testid="catalog-filter-jenis"><SelectValue placeholder="Jenis" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Jenis</SelectItem>
                <SelectItem value="INTER">INTER</SelectItem>
                <SelectItem value="RESMI">RESMI</SelectItem>
              </SelectContent>
            </Select>
            <Select value={draft.sort} onValueChange={(v) => setField("sort", v)}>
              <SelectTrigger data-testid="catalog-sort"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="baru">Terbaru</SelectItem>
                <SelectItem value="harga_naik">Harga Terendah</SelectItem>
                <SelectItem value="harga_turun">Harga Tertinggi</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap justify-end gap-2 mt-4">
            <Button type="button" variant="ghost" onClick={clearFilters}>Reset</Button>
            <Button type="button" onClick={applyFilters} data-testid="btn-apply-catalog-filter">
              <SlidersHorizontal className="w-4 h-4 mr-1.5" /> Terapkan
            </Button>
          </div>
        </Card>
      )}

      {error && <p className="text-rose-700 text-sm mb-4" role="alert">{error}</p>}
      {loading ? (
        <p className="text-center text-slate-500 py-20">Memuat katalog...</p>
      ) : error && items.length === 0 ? (
        <p className="text-center text-slate-500 py-20">Tidak dapat memuat produk saat ini.</p>
      ) : items.length === 0 ? (
        <div className="text-center text-slate-500 py-20" data-testid="catalog-empty">
          <p>Tidak ada produk yang cocok dengan filter Anda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4" data-testid="catalog-grid">
          {items.map((it) => <ProductCard key={it.id} item={it} />)}
        </div>
      )}
    </div>
  );
}
