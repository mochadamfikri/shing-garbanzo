import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";

export default function ProtectedRoute({ roles, children }) {
  const { user, bootstrapped } = useAuth();
  const location = useLocation();

  if (!bootstrapped) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-2">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs">Memeriksa hak akses...</span>
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
