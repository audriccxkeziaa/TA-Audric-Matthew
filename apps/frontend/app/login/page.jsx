"use client";
// =================================================================
// /login — Halaman autentikasi
// =================================================================
// Setelah submit berhasil, tampilkan LoginLoadingScreen sebelum
// melakukan redirect ke dashboard (admin) atau kasir (kasir).
// =================================================================

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Button, Input, Card, Spinner } from "@/components/ui";
import LoginLoadingScreen from "@/components/LoginLoadingScreen";

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [authenticated, setAuthenticated] = useState(null);

  // Sudah login → langsung arahkan sesuai role.
  useEffect(() => {
    if (!loading && user && !authenticated) {
      router.replace(user.role === "admin" ? "/dashboard" : "/kasir");
    }
  }, [user, loading, router, authenticated]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!username || !password) {
      setError("Username dan password wajib diisi");
      return;
    }
    setSubmitting(true);
    try {
      const profil = await login(username.trim(), password);
      // Jangan langsung redirect — biarkan overlay loading jalan dulu,
      // baru pindah halaman lewat callback onDone.
      setAuthenticated(profil);
    } catch (err) {
      setError(err.message || "Gagal login");
      setSubmitting(false);
    }
  }

  // Overlay loading profesional setelah login sukses.
  if (authenticated) {
    return (
      <LoginLoadingScreen
        role={authenticated.role}
        userName={authenticated.username}
        onDone={() =>
          router.replace(
            authenticated.role === "admin" ? "/dashboard" : "/kasir"
          )
        }
      />
    );
  }

  if (loading || user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner label="Memuat..." />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-600 to-brand-700 p-4">
      <Card className="w-full max-w-sm p-7">
        <div className="mb-6 text-center">
          <h1 className="text-lg font-bold text-slate-900">
            POS — CV Asia Jaya Maju
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Sistem Point of Sale Motorcycle Spareparts
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Username"
            type="text"
            placeholder="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
          <div className="relative">
            <Input
              label="Password"
              type={showPw ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPw((p) => !p)}
              className="absolute right-3 top-[34px] text-slate-400 hover:text-slate-600"
              tabIndex={-1}
            >
              {showPw ? (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                </svg>
              )}
            </button>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={submitting}
          >
            {submitting ? "Please wait..." : "Login"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
