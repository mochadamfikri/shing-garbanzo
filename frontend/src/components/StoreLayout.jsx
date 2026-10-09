import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import { ShoppingBag, UserCircle2, LogIn, LogOut, Store, Menu, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Beranda", end: true },
  { to: "/katalog", label: "Katalog" },
  { to: "/tentang", label: "Tentang" },
];

export default function StoreLayout() {
  const { user, logout } = useAuth();
  const { cart } = useCart();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const isCustomer = user?.role === "pelanggan";
  const isStaff = user && ["owner", "admin", "staf"].includes(user.role);

  const doLogout = async () => { await logout(); nav("/"); };

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col">
      <header className="sticky top-0 z-30 bg-white/85 backdrop-blur border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 md:px-5 h-14 flex items-center justify-between gap-4">
          <Link to="/" className="font-heading font-bold text-lg flex items-center gap-2" data-testid="store-logo">
            <span className="w-7 h-7 rounded-md bg-slate-900 text-white flex items-center justify-center text-xs">TH</span>
            Toko HP
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end}
                className={({ isActive }) => cn(
                  "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive ? "text-slate-900" : "text-slate-500 hover:text-slate-900"
                )}
                data-testid={`nav-${n.label.toLowerCase()}`}
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/keranjang" className="relative inline-flex" data-testid="link-keranjang">
              <Button variant="ghost" size="icon" aria-label="Keranjang">
                <ShoppingBag className="w-5 h-5" />
                {cart.jumlah_item > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-[#FF5722] text-white text-[10px] rounded-full px-1.5 py-0.5 font-medium" data-testid="cart-badge">
                    {cart.jumlah_item}
                  </span>
                )}
              </Button>
            </Link>
            {isCustomer && (
              <>
                <Link to="/pesanan" className="hidden md:inline-flex" data-testid="link-pesanan">
                  <Button variant="ghost" size="sm">Pesanan</Button>
                </Link>
                <Link to="/akun" className="hidden md:inline-flex" data-testid="link-akun">
                  <Button variant="ghost" size="sm"><UserCircle2 className="w-4 h-4 mr-1.5" />Akun</Button>
                </Link>
              </>
            )}
            {isStaff && (
              <Link to="/admin" className="hidden md:inline-flex" data-testid="link-admin">
                <Button variant="outline" size="sm"><Store className="w-4 h-4 mr-1.5" />Panel Admin</Button>
              </Link>
            )}
            {!user && (
              <Link to="/masuk" className="hidden md:inline-flex" data-testid="link-masuk">
                <Button size="sm"><LogIn className="w-4 h-4 mr-1.5" />Masuk</Button>
              </Link>
            )}
            {user && (
              <Button variant="ghost" size="icon" onClick={doLogout} aria-label="Keluar" className="hidden md:inline-flex" data-testid="btn-logout-store">
                <LogOut className="w-5 h-5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(!open)} data-testid="btn-mobile-menu">
              {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>
        {open && (
          <div className="md:hidden border-t border-slate-100 bg-white">
            <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col gap-1">
              {NAV.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.end} onClick={() => setOpen(false)}
                  className={({ isActive }) => cn("px-3 py-2 rounded-md text-sm font-medium", isActive ? "bg-slate-100 text-slate-900" : "text-slate-600")}
                >{n.label}</NavLink>
              ))}
              {user ? (
                <>
                  {isCustomer && (
                    <>
                      <Link to="/pesanan" onClick={() => setOpen(false)} className="px-3 py-2 text-sm text-slate-600">Pesanan Saya</Link>
                      <Link to="/akun" onClick={() => setOpen(false)} className="px-3 py-2 text-sm text-slate-600">Akun Saya</Link>
                    </>
                  )}
                  {isStaff && <Link to="/admin" onClick={() => setOpen(false)} className="px-3 py-2 text-sm text-slate-600">Panel Admin</Link>}
                  <button onClick={() => { setOpen(false); doLogout(); }} className="text-left px-3 py-2 text-sm text-rose-600">Keluar</button>
                </>
              ) : (
                <>
                  <Link to="/masuk" onClick={() => setOpen(false)} className="px-3 py-2 text-sm text-slate-900">Masuk</Link>
                  <Link to="/daftar" onClick={() => setOpen(false)} className="px-3 py-2 text-sm text-[#0052FF]">Daftar</Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-slate-100 py-10 mt-10 bg-slate-50">
        <div className="max-w-6xl mx-auto px-5 grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
          <div>
            <p className="font-heading font-bold">Toko HP</p>
            <p className="text-slate-500 mt-1">Smartphone resmi & inter dengan garansi toko.</p>
          </div>
          <div>
            <p className="font-semibold mb-2">Belanja</p>
            <ul className="text-slate-500 space-y-1">
              <li><Link to="/katalog">Katalog</Link></li>
              <li><Link to="/keranjang">Keranjang</Link></li>
            </ul>
          </div>
          <div>
            <p className="font-semibold mb-2">Akun</p>
            <ul className="text-slate-500 space-y-1">
              <li><Link to="/masuk">Masuk</Link></li>
              <li><Link to="/daftar">Daftar</Link></li>
            </ul>
          </div>
          <div>
            <p className="font-semibold mb-2">Info</p>
            <ul className="text-slate-500 space-y-1">
              <li><Link to="/tentang">Tentang</Link></li>
              <li><Link to="/privasi">Privasi</Link></li>
            </ul>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-5 pt-6 mt-6 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
          <span>© {new Date().getFullYear()} Toko HP</span>
          <span>Fase 2 · Katalog & Registrasi aktif</span>
        </div>
      </footer>
    </div>
  );
}
