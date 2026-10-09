import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth";
import { CartProvider } from "@/lib/cart";
import { SettingsProvider } from "@/lib/settings";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminLayout from "@/components/AdminLayout";
import StoreLayout from "@/components/StoreLayout";
import WhatsAppFloat from "@/components/WhatsAppFloat";

import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import InventoryListPage from "@/pages/InventoryListPage";
import InventoryFormPage from "@/pages/InventoryFormPage";
import InventoryDetailPage from "@/pages/InventoryDetailPage";

import StorefrontHome from "@/pages/StorefrontHome";
import KatalogPage from "@/pages/KatalogPage";
import ProdukDetailPage from "@/pages/ProdukDetailPage";
import KeranjangPage from "@/pages/KeranjangPage";
import CustomerRegisterPage from "@/pages/CustomerRegisterPage";
import AkunPage from "@/pages/AkunPage";
import CheckoutPage from "@/pages/CheckoutPage";
import PesananPage from "@/pages/PesananPage";
import PesananDetailPage from "@/pages/PesananDetailPage";

import PengaturanPage from "@/pages/admin/PengaturanPage";
import OrdersAdminPage from "@/pages/admin/OrdersAdminPage";
import OrderAdminDetailPage from "@/pages/admin/OrderAdminDetailPage";
import LaporanPage from "@/pages/admin/LaporanPage";
import PengeluaranPage from "@/pages/admin/PengeluaranPage";

const STAFF = ["owner", "admin", "staf"];
const FINANCE = ["owner", "admin"];

function TentangPage() {
  return (
    <div className="max-w-3xl mx-auto px-5 py-12">
      <h1 className="font-heading font-bold text-3xl mb-3">Tentang Toko HP</h1>
      <p className="text-slate-600">Kami adalah toko smartphone yang menyediakan unit resmi dan inter dengan garansi toko dan pemeriksaan IMEI.</p>
    </div>
  );
}

function PrivasiPage() {
  return (
    <div className="max-w-3xl mx-auto px-5 py-12">
      <h1 className="font-heading font-bold text-3xl mb-3">Kebijakan Privasi</h1>
      <p className="text-slate-600 mb-3">Data pelanggan hanya digunakan untuk pengelolaan transaksi dan layanan toko. Persetujuan promosi bersifat opsional dan dapat dicabut kapan saja.</p>
      <p className="text-slate-600">Anda berhak meminta akses, koreksi, dan penghapusan data pribadi Anda melalui kontak toko.</p>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <CartProvider>
          <BrowserRouter>
            <Toaster position="top-right" richColors />
            <Routes>
              <Route element={<StoreLayout />}>
                <Route path="/" element={<StorefrontHome />} />
                <Route path="/katalog" element={<KatalogPage />} />
                <Route path="/produk/:id" element={<ProdukDetailPage />} />
                <Route path="/keranjang" element={<KeranjangPage />} />
                <Route path="/checkout" element={<CheckoutPage />} />
                <Route path="/pesanan" element={<PesananPage />} />
                <Route path="/pesanan/:id" element={<PesananDetailPage />} />
                <Route path="/akun" element={<AkunPage />} />
                <Route path="/tentang" element={<TentangPage />} />
                <Route path="/privasi" element={<PrivasiPage />} />
              </Route>

              <Route path="/masuk" element={<LoginPage />} />
              <Route path="/daftar" element={<CustomerRegisterPage />} />

              <Route
                path="/admin"
                element={<ProtectedRoute roles={STAFF}><AdminLayout /></ProtectedRoute>}
              >
                <Route index element={<DashboardPage />} />
                <Route path="inventaris" element={<InventoryListPage />} />
                <Route path="inventaris/baru" element={<InventoryFormPage mode="create" />} />
                <Route path="inventaris/:id" element={<InventoryDetailPage />} />
                <Route path="inventaris/:id/edit" element={<InventoryFormPage mode="edit" />} />
                <Route path="pesanan" element={<OrdersAdminPage />} />
                <Route path="pesanan/:id" element={<OrderAdminDetailPage />} />
                <Route path="laporan" element={
                  <ProtectedRoute roles={FINANCE}><LaporanPage /></ProtectedRoute>
                } />
                <Route path="pengeluaran" element={
                  <ProtectedRoute roles={FINANCE}><PengeluaranPage /></ProtectedRoute>
                } />
                <Route path="pengaturan" element={
                  <ProtectedRoute roles={FINANCE}><PengaturanPage /></ProtectedRoute>
                } />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <WhatsAppFloat />
          </BrowserRouter>
        </CartProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}
