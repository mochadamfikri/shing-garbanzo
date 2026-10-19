import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth";
import { SettingsProvider } from "@/lib/settings";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminLayout from "@/components/AdminLayout";

import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import InventoryListPage from "@/pages/InventoryListPage";
import InventoryFormPage from "@/pages/InventoryFormPage";
import InventoryDetailPage from "@/pages/InventoryDetailPage";

import PengaturanPage from "@/pages/admin/PengaturanPage";
import LaporanPage from "@/pages/admin/LaporanPage";
import PosPage from "@/pages/admin/PosPage";
import ImeiCheckPage from "@/pages/admin/ImeiCheckPage";
import { useAuth } from "@/lib/auth";

const STAFF = ["owner", "admin", "staf"];
const FINANCE = ["owner", "admin"];

function RootHandler() {
  const { user, bootstrapped } = useAuth();
  if (!bootstrapped) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Memuat...
      </div>
    );
  }
  if (!user) {
    return <LoginPage />;
  }
  return <Navigate to="/admin" replace />;
}

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <SettingsProvider>
          <BrowserRouter>
            <Toaster position="top-right" richColors />
            <Routes>
              {/* Root "/" langsung render LoginPage jika belum login, atau Dashboard jika sudah login */}
              <Route path="/" element={<RootHandler />} />
              <Route path="/masuk" element={<RootHandler />} />
              <Route path="/login" element={<RootHandler />} />

              {/* Admin Protected Routes */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute roles={STAFF}>
                    <AdminLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<DashboardPage />} />
                <Route path="inventaris" element={<InventoryListPage />} />
                <Route path="inventaris/baru" element={<InventoryFormPage mode="create" />} />
                <Route path="inventaris/:id" element={<InventoryDetailPage />} />
                <Route path="inventaris/:id/edit" element={<InventoryFormPage mode="edit" />} />
                <Route path="penjualan" element={<PosPage />} />
                <Route path="cek-imei" element={<ImeiCheckPage />} />
                <Route
                  path="laporan"
                  element={
                    <ProtectedRoute roles={FINANCE}>
                      <LaporanPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="pengaturan"
                  element={
                    <ProtectedRoute roles={FINANCE}>
                      <PengaturanPage />
                    </ProtectedRoute>
                  }
                />
              </Route>

              {/* Fallback all to root */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </SettingsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
