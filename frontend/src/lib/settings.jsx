import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

const SettingsCtx = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get("/settings/public");
      setSettings(data);
    } catch (e) {
      // ignore
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (!settings) return;
    document.title = `${settings.nama_toko || "Sadam Gadget"}`;
    if (settings.logo_url) {
      let ico = document.querySelector('link[rel="icon"]');
      if (!ico) { ico=document.createElement("link");ico.rel="icon";document.head.appendChild(ico); }
      ico.href=settings.logo_url;
    }
  }, [settings]);

  return (
    <SettingsCtx.Provider value={{ settings, refresh }}>
      {children}
    </SettingsCtx.Provider>
  );
}

export function useSettings() {
  const v = useContext(SettingsCtx);
  if (!v) throw new Error("useSettings harus di dalam SettingsProvider");
  return v;
}
