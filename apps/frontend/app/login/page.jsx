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

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Profil yang baru sukses login → trigger overlay loading + redirect.
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
    if (!email || !password) {
      setError("Email dan password wajib diisi");
      return;
    }
    setSubmitting(true);
    try {
      const profil = await login(email.trim(), password);
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
        userName={authenticated.username || authenticated.email}
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
            Sistem Point of Sale Suku Cadang Motor
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email"
            type="email"
            placeholder="nama@asiajaya.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
          />
          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />

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
            {submitting ? "Memproses..." : "Masuk"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
