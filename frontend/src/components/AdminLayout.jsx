import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useSettings } from "@/lib/settings";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Smartphone,
  ScanLine,
  ShieldCheck,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

// 6 Core Navigations
const NAV_ITEMS = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true, testId: "nav-dashboard" },
  { to: "/admin/inventaris", label: "Inventaris HP", icon: Smartphone, testId: "nav-inventaris" },
  { to: "/admin/penjualan", label: "Kasir / POS", icon: ScanLine, testId: "nav-pos" },
  { to: "/admin/cek-imei", label: "Cek IMEI", icon: ShieldCheck, testId: "nav-cek-imei" },
  { to: "/admin/laporan", label: "Laporan", icon: BarChart3, testId: "nav-laporan" },
  { to: "/admin/pengaturan", label: "Pengaturan", icon: Settings, testId: "nav-pengaturan" },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const { settings } = useSettings();
  const nav = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    nav("/masuk");
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200/80 dark:border-slate-800 transition-colors">
        <div className="flex items-center justify-between px-3 md:px-6 h-14 md:h-16">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden text-slate-600 dark:text-slate-300"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Menu"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
            <Link to="/admin" className="flex items-center gap-2.5 font-heading font-bold text-lg md:text-xl tracking-tight">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center text-sm font-bold shadow-sm shadow-blue-500/20">
                SG
              </div>
              <div className="flex flex-col">
                <span className="leading-tight text-slate-900 dark:text-white font-extrabold">{settings?.nama_toko || "Sadam Gadget"}</span>
                <span className="text-[10px] tracking-wider text-blue-600 dark:text-blue-400 font-semibold uppercase">Management Suite</span>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            <ThemeToggle />

            <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-1 hidden sm:block" />

            <div className="hidden sm:flex flex-col text-right leading-tight">
              <span className="text-xs md:text-sm font-semibold text-slate-800 dark:text-slate-200">{user?.nama || "Staff"}</span>
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">{user?.role}</span>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="h-9 w-9 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-full"
              aria-label="Keluar"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Desktop Sidebar */}
        <aside
          className={cn(
            "fixed md:sticky top-14 md:top-16 h-[calc(100vh-56px)] md:h-[calc(100vh-64px)] w-60 bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800 p-3 overflow-y-auto z-30 transition-transform duration-200 ease-in-out",
            sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          )}
        >
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3 py-2">
            Menu Operasional
          </div>
          <nav className="space-y-1 mt-1">
            {NAV_ITEMS.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                data-testid={n.testId}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all",
                    isActive
                      ? "bg-blue-600 text-white shadow-sm shadow-blue-500/30"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60"
                  )
                }
              >
                <n.icon className="w-4 h-4 shrink-0" />
                {n.label}
              </NavLink>
            ))}
          </nav>

          <div className="mt-8 px-3 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
            <p className="font-semibold text-slate-700 dark:text-slate-300">Sadam Gadget v3</p>
            <p className="mt-0.5">Admin-Only Management Suite</p>
          </div>
        </aside>

        {/* Backdrop for Mobile Sidebar */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-20 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 p-3.5 sm:p-5 md:p-8 pb-28 md:pb-12 max-w-7xl mx-auto w-full">
          <Outlet />
        </main>

        {/* Mobile Modern Bottom Navigation (Fixed on Phone Screens) */}
        <nav
          aria-label="Navigasi Mobile"
          className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-800 pb-[env(safe-area-inset-bottom)] shadow-lg"
        >
          <div className="grid grid-cols-6 h-16 px-1">
            {NAV_ITEMS.map((n) => (
              <NavLink
                key={n.to}
                end={n.end}
                to={n.to}
                className={({ isActive }) =>
                  cn(
                    "flex flex-col gap-1 items-center justify-center text-[10px] font-semibold transition-colors",
                    isActive
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                  )
                }
              >
                <n.icon className="h-5 w-5" />
                <span className="truncate max-w-[54px]">{n.label.split(" ")[0]}</span>
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}
