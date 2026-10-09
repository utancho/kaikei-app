import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { api } from "../lib/api";
import type { Business } from "../lib/types";

interface BusinessContextValue {
  businesses: Business[];
  currentBusiness: Business | null;
  loading: boolean;
  error: string;
  setCurrentBusinessId: (id: string) => void;
  refresh: () => Promise<void>;
}

const BusinessContext = createContext<BusinessContextValue | null>(null);

const STORAGE_KEY = "kaikei.currentBusinessId";

export function BusinessProvider({ children }: { children: ReactNode }) {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(()=>{try{return localStorage.getItem(STORAGE_KEY);}catch{return null;}});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const list = await api.listBusinesses();
      setBusinesses(list);
      setCurrentId((prev) => {
        if (prev && list.some((b) => b.id === prev)) return prev;
        return list[0]?.id ?? null;
      });
    } catch (e) { setError(e instanceof Error ? e.message : "事業者データを読み込めませんでした"); } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (currentId) { try { localStorage.setItem(STORAGE_KEY, currentId); } catch { /* selection remains usable */ } }
  }, [currentId]);

  const currentBusiness = businesses.find((b) => b.id === currentId) ?? null;

  return (
    <BusinessContext.Provider
      value={{ businesses, currentBusiness, loading, error, setCurrentBusinessId: setCurrentId, refresh }}
    >
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusiness() {
  const ctx = useContext(BusinessContext);
  if (!ctx) throw new Error("useBusiness must be used within BusinessProvider");
  return ctx;
}
