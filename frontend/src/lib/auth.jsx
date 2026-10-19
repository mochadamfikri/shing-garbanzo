import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, setBearer, formatApiErrorDetail } from "@/lib/api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null = checking, false = anon, obj = logged in
  const [bootstrapped, setBootstrapped] = useState(false);

  const refreshMe = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
      return data;
    } catch (e) {
      setUser(false);
      return null;
    } finally {
      setBootstrapped(true);
    }
  }, []);

  useEffect(() => {
    // Timeout safeguard agar tidak pernah stuck di 'Memuat...' lebih dari 1.5 detik
    const timer = setTimeout(() => {
      setBootstrapped(true);
    }, 1500);

    refreshMe().finally(() => clearTimeout(timer));
  }, [refreshMe]);

  const login = async (email, password) => {
    try {
      const { data, headers } = await api.post("/auth/login", { email, password });
      const tok = headers["x-access-token"] || headers["X-Access-Token"];
      if (tok) {
        setBearer(tok);
      }
      setUser(data);
      return data;
    } catch (e) {
      const msg = formatApiErrorDetail(e?.response?.data?.detail) || e.message;
      throw new Error(msg);
    }
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch { /* ignore */ }
    setBearer(null);
    setUser(false);
  };

  return (
    <AuthCtx.Provider value={{ user, bootstrapped, login, logout, refreshMe }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const v = useContext(AuthCtx);
  if (!v) throw new Error("useAuth harus di dalam AuthProvider");
  return v;
}
