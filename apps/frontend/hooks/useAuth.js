"use client";
import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { authApi } from "@/lib/api";
import {
  getSession,
  setSession,
  clearSession,
} from "@/lib/api-client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef(null);

  useEffect(() => {
    let aktif = true;
    async function bootstrap() {
      const session = getSession();
      if (!session?.access_token) {
        if (aktif) setLoading(false);
        return;
      }
      try {
        const res = await authApi.me();
        if (aktif) setUser(res.user);
      } catch {
        clearSession();
        if (aktif) setUser(null);
      } finally {
        if (aktif) setLoading(false);
      }
    }
    bootstrap();
    return () => {
      aktif = false;
    };
  }, []);

  useEffect(() => {
    if (!user) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(async () => {
      try {
        const res = await authApi.me();
        if (!res.user || res.user.is_active === false) {
          clearSession();
          setUser(null);
          if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
            window.location.href = "/login";
          }
        }
      } catch {
        clearSession();
        setUser(null);
        if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
          window.location.href = "/login";
        }
      }
    }, 15_000);
    return () => clearInterval(intervalRef.current);
  }, [user]);

  const login = useCallback(async (username, password) => {
    const res = await authApi.login(username, password);
    setSession({
      access_token: res.session.access_token,
      refresh_token: res.session.refresh_token,
      expires_at: res.session.expires_at,
      user: res.user,
    });
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Abaikan — tetap bersihkan sesi lokal.
    }
    clearSession();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth harus dipakai di dalam <AuthProvider>");
  return ctx;
}
