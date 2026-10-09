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
    refreshMe();
  }, [refreshMe]);

  const login = async (email, password) => {
    try {
      // Minta token di body response selain cookie (via header)
      const { data, headers } = await api.post("/auth/login", { email, password });
      // Ambil access_token dari cookies document jika ada
      const tok = headers["x-access-token"];
      if (tok) setBearer(tok);
      // fetch /me untuk memastikan
      const me = await refreshMe();
      return me || data;
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
