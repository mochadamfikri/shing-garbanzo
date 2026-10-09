import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import ProductCard from "@/components/ProductCard";
import { ArrowRight, ShieldCheck, Store, Headphones, Smartphone } from "lucide-react";

export default function StorefrontHome() {
  const [featured, setFeatured] = useState([]);
  const [brands, setBrands] = useState([]);

  useEffect(() => {
    api.get("/catalog/featured").then((r) => setFeatured(r.data)).catch(() => {});
    api.get("/catalog/brands").then((r) => setBrands(r.data)).catch(() => {});
  }, []);

  return (
    <>
      <section className="max-w-6xl mx-auto px-5 py-10 md:py-16 grid md:grid-cols-12 gap-8 items-center">
        <div className="md:col-span-7">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500 mb-3">Toko Smartphone Terpercaya</p>
          <h1 className="font-heading font-bold text-4xl md:text-6xl leading-[1.05] tracking-tight">
            Smartphone resmi & inter, <br />
            <span className="text-[#FF5722]">dengan garansi toko.</span>
          </h1>
          <p className="mt-5 text-slate-600 max-w-xl text-base md:text-lg">
            Pilih dari koleksi smartphone pilihan kami. IMEI terverifikasi, kondisi diperiksa, dan harga transparan.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/katalog">
              <Button className="bg-slate-900 hover:bg-slate-800 h-11 px-6" data-testid="btn-hero-katalog">
                Lihat Katalog <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link to="/daftar">
              <Button variant="outline" className="h-11 px-6" data-testid="btn-hero-daftar">Daftar Pelanggan</Button>
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-6 text-sm text-slate-500">
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="w-4 h-4" /> IMEI terverifikasi</span>
            <span className="inline-flex items-center gap-1.5"><Store className="w-4 h-4" /> Unit asli</span>
            <span className="inline-flex items-center gap-1.5"><Headphones className="w-4 h-4" /> Layanan servis</span>
          </div>
        </div>
        <div className="md:col-span-5 relative">
          <div className="aspect-[4/5] rounded-2xl overflow-hidden shadow-xl bg-slate-100">
            <img src="https://images.unsplash.com/photo-1777028773178-7c7e991646d7?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxODF8MHwxfHNlYXJjaHw0fHxwcmVtaXVtJTIwc21hcnRwaG9uZSUyMGNsb3NlJTIwdXB8ZW58MHx8fHwxNzkxNDgyNjQ2fDA&ixlib=rb-4.1.0&q=85"
                 alt="Smartphone" className="w-full h-full object-cover" />
          </div>
        </div>
      </section>

      {brands.length > 0 && (
        <section className="max-w-6xl mx-auto px-5 py-6">
          <h2 className="font-heading font-bold text-xl mb-3">Pilih merek favorit</h2>
          <div className="flex flex-wrap gap-2">
            {brands.map((b) => (
              <Link key={b.merek} to={`/katalog?merek=${encodeURIComponent(b.merek)}`}>
                <Button variant="outline" size="sm" data-testid={`brand-${b.merek}`}>
                  <Smartphone className="w-4 h-4 mr-1.5" /> {b.merek}
                  <span className="ml-2 text-xs text-slate-500">{b.count}</span>
                </Button>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="max-w-6xl mx-auto px-5 py-10">
        <div className="flex items-end justify-between mb-5">
          <div>
            <h2 className="font-heading font-bold text-2xl md:text-3xl">Produk Unggulan</h2>
            <p className="text-slate-500 text-sm">Pilihan terbaik dari toko kami</p>
          </div>
          <Link to="/katalog" className="text-sm text-[#0052FF] hover:underline">Lihat semua →</Link>
        </div>
        {featured.length === 0 ? (
          <div className="text-sm text-slate-500 bg-slate-50 border border-slate-100 rounded-xl p-10 text-center">
            Belum ada produk yang ditayangkan. Admin dapat menerbitkan unit dari panel inventaris.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4" data-testid="featured-grid">
            {featured.map((item) => <ProductCard key={item.id} item={item} />)}
          </div>
        )}
      </section>
    </>
  );
}
