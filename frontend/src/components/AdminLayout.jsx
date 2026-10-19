import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { ScanLine } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { formatRupiah } from "@/lib/format";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Smartphone, LogOut, Store, Menu, ShoppingCart, Settings, BarChart3, Receipt, Bell, QrCode } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useAuth as useAuthHook } from "@/lib/auth";
import { useSettings } from "@/lib/settings";

const NAV_ALL = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true, testId: "nav-dashboard" },
  { to: "/admin/inventaris", label: "Inventaris HP", icon: Smartphone, testId: "nav-inventaris" },
  { to: "/admin/penjualan", label: "Penjualan Kasir", icon: ScanLine, testId: "nav-pos" },
  { to: "/admin/cek-imei", label: "Cek IMEI CEIR", icon: Smartphone, testId: "nav-cek-imei" },
  { to: "/admin/analitik-v2", label: "Analitik V2", icon: BarChart3, testId: "nav-analitik-v2", roles:["owner","admin"] },
  { to: "/admin/analitik-user", label: "Analitik User", icon: LayoutDashboard, testId: "nav-analitik-user", roles:["owner","admin"] },
  { to: "/admin/pesanan", label: "Pesanan", icon: ShoppingCart, testId: "nav-pesanan" },
  { to: "/admin/pembayaran-qris", label: "Pembayaran QRIS", icon: QrCode, testId: "nav-pembayaran-qris" },
  { to: "/admin/laporan", label: "Laporan", icon: BarChart3, testId: "nav-laporan", roles: ["owner", "admin"] },
  { to: "/admin/pengeluaran", label: "Pengeluaran", icon: Receipt, testId: "nav-pengeluaran", roles: ["owner", "admin"] },
  { to: "/admin/pengaturan", label: "Pengaturan", icon: Settings, testId: "nav-pengaturan", roles: ["owner", "admin"] },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const { settings } = useSettings();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [notif, setNotif] = useState({ count: 0, items: [] });
  const [panelOpen, setPanelOpen] = useState(false);
  const prevCount = useRef(null);

  const loadNotif = useCallback(() => {
    api.get("/orders/admin/notifikasi").then((r) => {
      setNotif(r.data);
      if (prevCount.current !== null && r.data.count > prevCount.current) {
        toast.success(`${r.data.count - prevCount.current} pembayaran QRIS baru diterima`);
      }
      prevCount.current = r.data.count;
    }).catch(() => {});
  }, []);

  useEffect(() => {
    loadNotif();
    const t = setInterval(loadNotif, 20000);
    return () => clearInterval(t);
  }, [loadNotif]);

  const markRead = () => {
    api.post("/orders/admin/notifikasi/baca").then(() => {
      setNotif({ count: 0, items: [] });
      prevCount.current = 0;
    }).catch(() => {});
  };

  const handleLogout = async () => {
    await logout();
    nav("/masuk");
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="flex items-center justify-between px-4 md:px-6 h-14">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost" size="icon" className="md:hidden"
              onClick={() => setOpen(!open)} data-testid="btn-toggle-sidebar"
            >
              <Menu className="w-5 h-5" />
            </Button>
            <Link to="/admin" className="flex items-center gap-2 font-heading font-bold text-lg tracking-tight">
              {settings?.logo_url?<img src={settings.logo_url} alt="Logo toko" className="w-7 h-7 object-contain rounded-md"/>:<span className="w-7 h-7 rounded-md bg-[#0052FF] text-white flex items-center justify-center text-xs">TH</span>}
              {settings?.nama_toko||"Toko HP"} · Admin
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex flex-col text-right leading-tight">
              <span className="text-sm font-medium" data-testid="auth-user-name">{user?.nama}</span>
              <span className="text-[11px] uppercase tracking-widest text-slate-500">{user?.role}</span>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout} data-testid="btn-logout" aria-label="Keluar">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className={cn(
          "fixed md:sticky top-14 h-[calc(100vh-56px)] w-64 bg-white border-r border-slate-200 p-3 overflow-y-auto z-20 transition-transform",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}>
          <nav className="space-y-1">
            {NAV_ALL.filter((n) => !n.roles || n.roles.includes(user?.role)).map((n) => (
              <NavLink
                key={n.to} to={n.to} end={n.end}
                data-testid={n.testId}
                onClick={() => setOpen(false)}
                className={({ isActive }) => cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-[#0052FF]/10 text-[#0052FF]"
                    : "text-slate-700 hover:bg-slate-100"
                )}
              >
                <n.icon className="w-4 h-4" />
                {n.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="flex-1 min-w-0 p-3 pb-24 md:p-6">
          <Outlet />
        </main>
        <nav aria-label="Navigasi mobile" className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 pb-[env(safe-area-inset-bottom)]"><div className="grid grid-cols-4 h-16">{[{to:"/admin",name:"Beranda",icon:LayoutDashboard,end:true},{to:"/admin/penjualan",name:"Kasir",icon:ScanLine},{to:"/admin/inventaris",name:"Inventaris",icon:Smartphone},{to:"/admin/pesanan",name:"Pesanan",icon:ShoppingCart}].map(n=><NavLink key={n.to} end={n.end} to={n.to} className={({isActive})=>cn("flex flex-col gap-1 items-center justify-center text-xs",isActive?"text-blue-700":"text-slate-500")}><n.icon className="h-5 w-5"/>{n.name}</NavLink>)}</div></nav>
      </div>
    </div>
  );
}
