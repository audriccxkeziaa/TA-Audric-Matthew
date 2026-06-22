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
      } catch (err) {
        if (err?.status === 401 || err?.status === 403) {
          clearSession();
          if (aktif) setUser(null);
        } else if (aktif) {
          // Backend sekejap tak terjangkau (redeploy/cold-start) → percayai
          // sesi tersimpan dulu, JANGAN paksa logout saat baru buka halaman.
          // Request berikutnya akan memvalidasi ulang.
          setUser(session.user || null);
        }
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
        if (!res.user) {
          clearSession();
          setUser(null);
          if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
            window.location.href = "/login";
          }
        }
      } catch (err) {
        // Hanya logout kalau sesi memang TIDAK SAH (401 token mati/akun
        // dinonaktifkan, atau 403). Error jaringan sementara (backend blip /
        // redeploy) JANGAN melempar user keluar — coba lagi siklus berikutnya.
        if (err?.status === 401 || err?.status === 403) {
          clearSession();
          setUser(null);
          if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
            window.location.href = "/login";
          }
        }
      }
    }, 15_000);
    return () => clearInterval(intervalRef.current);
  }, [user]);

  // Heartbeat single-session: deteksi "didepak" oleh login baru di perangkat/tab
  // lain dalam <2 detik. Memanggil endpoint ringan /auth/session-check tiap 1,5
  // detik; bila sesi ini bukan lagi sesi aktif, backend membalas 401
  // SESSION_SUPERSEDED → bersihkan sesi & arahkan ke login dengan pesan.
  useEffect(() => {
    if (!user) return;
    const id = setInterval(async () => {
      try {
        await authApi.sessionCheck();
      } catch (err) {
        if (err?.status === 401 || err?.status === 403) {
          clearSession();
          setUser(null);
          if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
            window.location.href = "/login?reason=session";
          }
        }
        // Error jaringan sementara (status 0) diabaikan — coba lagi siklus berikutnya.
      }
    }, 1500);
    return () => clearInterval(id);
  }, [user]);

  const login = useCallback(async (username, password) => {
    const res = await authApi.login(username, password);
    setSession({
      access_token: res.session.access_token,
      refresh_token: res.session.refresh_token,
      expires_at: res.session.expires_at,
      session_id: res.session.session_id, // single-session (Last-Login-Wins)
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
