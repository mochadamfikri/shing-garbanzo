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
  if (!user) {
    return <Navigate to="/masuk" replace state={{ from: location.pathname }} />;
  }
  if (roles && !roles.includes(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center text-rose-600" data-testid="forbidden">
        Hak akses tidak mencukupi
      </div>
    );
  }
  return children;
}
