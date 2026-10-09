import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Smartphone, LogOut, Store, Menu, ShoppingCart, Settings, BarChart3, Receipt } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth as useAuthHook } from "@/lib/auth";

const NAV_ALL = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true, testId: "nav-dashboard" },
  { to: "/admin/inventaris", label: "Inventaris HP", icon: Smartphone, testId: "nav-inventaris" },
  { to: "/admin/pesanan", label: "Pesanan", icon: ShoppingCart, testId: "nav-pesanan" },
  { to: "/admin/laporan", label: "Laporan", icon: BarChart3, testId: "nav-laporan", roles: ["owner", "admin"] },
  { to: "/admin/pengeluaran", label: "Pengeluaran", icon: Receipt, testId: "nav-pengeluaran", roles: ["owner", "admin"] },
  { to: "/admin/pengaturan", label: "Pengaturan", icon: Settings, testId: "nav-pengaturan", roles: ["owner", "admin"] },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

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
              <span className="w-7 h-7 rounded-md bg-[#0052FF] text-white flex items-center justify-center text-xs">TH</span>
              Toko HP · Admin
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/" className="hidden md:inline-flex">
              <Button variant="outline" size="sm" data-testid="btn-view-store">
                <Store className="w-4 h-4 mr-1.5" /> Lihat Toko
              </Button>
            </Link>
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

        <main className="flex-1 min-w-0 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
