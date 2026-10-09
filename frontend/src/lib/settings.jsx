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
