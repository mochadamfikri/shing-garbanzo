import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const CartCtx = createContext(null);

export function CartProvider({ children }) {
  const { user } = useAuth();
  const [cart, setCart] = useState({ items: [], jumlah_item: 0, subtotal: 0 });
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user || user.role !== "pelanggan") {
      setCart({ items: [], jumlah_item: 0, subtotal: 0 });
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get("/customer");
      setCart(data);
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const addItem = async (unit_id) => {
    try {
      await api.post("/customer", { unit_id });
      await refresh();
      return { ok: true };
    } catch (e) {
      return { ok: false, message: formatApiErrorDetail(e?.response?.data?.detail) || e.message };
    }
  };

  const removeItem = async (unit_id) => {
    try {
      await api.delete(`/customer/${unit_id}`);
      await refresh();
      return { ok: true };
    } catch (e) {
      return { ok: false, message: formatApiErrorDetail(e?.response?.data?.detail) || e.message };
    }
  };

  const clear = async () => {
    try { await api.delete("/customer"); } catch { /* ignore */ }
    await refresh();
  };

  return (
    <CartCtx.Provider value={{ cart, loading, refresh, addItem, removeItem, clear }}>
      {children}
    </CartCtx.Provider>
  );
}

export function useCart() {
  const v = useContext(CartCtx);
  if (!v) throw new Error("useCart harus di dalam CartProvider");
  return v;
}
