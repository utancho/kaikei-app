import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { api, ApiError } from "../lib/api";

interface AuthUser {
  id: string;
  email: string;
  name: string | null;
}

interface SubscriptionInfo {
  status: string;
  currentPeriodEnd: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  subscription: SubscriptionInfo | null;
  loading: boolean;
  isSubscriptionActive: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await api.me();
      setUser(res.user);
      setSubscription(res.subscription);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setUser(null);
        setSubscription(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (email: string, password: string) => {
    await api.login(email, password);
    await refresh();
  };

  const signup = async (email: string, password: string, name?: string) => {
    await api.signup(email, password, name);
    await refresh();
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
    setSubscription(null);
  };

  const isSubscriptionActive = subscription?.status === "TRIALING" || subscription?.status === "ACTIVE";

  return (
    <AuthContext.Provider value={{ user, subscription, loading, isSubscriptionActive, login, signup, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
