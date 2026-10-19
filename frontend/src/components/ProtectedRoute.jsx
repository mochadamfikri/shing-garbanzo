import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";

export default function ProtectedRoute({ roles, children }) {
  const { user, bootstrapped } = useAuth();
  const location = useLocation();

  if (!bootstrapped) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500" data-testid="auth-loading">
        Memuat sesi...
      </div>
    );
  }
  // Jika belum login, redirect langsung ke "/" (halaman login bersih)
  if (!user) {
    return <Navigate to="/" replace />;
  }
  // Jika role bukan staff (misal token pelanggan lama tersisa), paksa logout dan arahkan ke login
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return children;
}
