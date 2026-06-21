"use client";
// /login — Halaman autentikasi
// Setelah submit berhasil, tampilkan LoginLoadingScreen sebelum
// melakukan redirect ke dashboard (admin) atau kasir (kasir).

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { authApi } from "@/lib/api";
import { Button, Input, Card, Spinner } from "@/components/ui";
import LoginLoadingScreen from "@/components/LoginLoadingScreen";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [authenticated, setAuthenticated] = useState(null);

  // ----- Lupa password (kirim link reset via email) -----
  const [forgotMode, setForgotMode] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetMsg, setResetMsg] = useState("");
  const [resetErr, setResetErr] = useState("");
  const [resetSending, setResetSending] = useState(false);
  // Hanya true bila login gagal pada akun ADMIN → tampilkan opsi "Lupa Password?".
  const [canRecover, setCanRecover] = useState(false);

  // Sudah login → langsung arahkan sesuai role.
  useEffect(() => {
    if (!loading && user && !authenticated) {
      router.replace(user.role === "admin" ? "/dashboard" : "/kasir");
    }
  }, [user, loading, router, authenticated]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setCanRecover(false);
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
      // Backend hanya kirim canRecover=true untuk akun admin → kasir/unknown
      // tidak akan melihat opsi reset.
      setCanRecover(!!err?.canRecover);
      setSubmitting(false);
    }
  }

  async function handleForgotSubmit(e) {
    e.preventDefault();
    setResetErr("");
    setResetMsg("");
    const email = resetEmail.trim();
    if (!email) {
      setResetErr("Email wajib diisi");
      return;
    }
    setResetSending(true);
    // Cek ke backend: kirim link HANYA jika email terdaftar; kalau tidak,
    // tampilkan pesan error spesifik "Email tidak terdaftar".
    try {
      const res = await authApi.forgotPassword(email);
      setResetMsg(
        res?.message || "Link reset password telah dikirim. Cek inbox / folder spam."
      );
    } catch (err) {
      setResetErr(err?.message || "Gagal mengirim link reset");
    } finally {
      setResetSending(false);
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900 p-4">
      {/* Ornamen latar lembut */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-brand-500/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-brand-400/20 blur-3xl" />

      <Card className="relative w-full max-w-sm p-7 shadow-pop">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg ring-1 ring-brand-700/20">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7l9-4 9 4-9 4-9-4zM3 7v10l9 4 9-4V7" />
            </svg>
          </span>
          <h1 className="text-lg font-bold tracking-tight text-slate-900">
            POS — CV Asia Jaya Maju
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Sistem Point of Sale Suku Cadang Motor
          </p>
        </div>

        {!forgotMode && (
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
              className="absolute right-3 top-[37px] text-slate-400 transition-colors hover:text-slate-600"
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
            loading={submitting}
          >
            {submitting ? "Please wait..." : "Login"}
          </Button>
        </form>
        )}

        {!forgotMode && canRecover && (
          <button
            type="button"
            onClick={() => {
              setForgotMode(true);
              setError("");
              setResetErr("");
              setResetMsg("");
            }}
            className="mt-4 block w-full text-center text-sm font-medium text-brand-700 hover:underline"
          >
            Lupa Password?
          </button>
        )}

        {forgotMode && (
          <form onSubmit={handleForgotSubmit} className="space-y-4">
            <p className="text-sm text-slate-500">
              Masukkan email akun Anda. Kami kirim link untuk mengatur ulang
              password.
            </p>
            <Input
              label="Email"
              type="email"
              placeholder="email@contoh.com"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              autoComplete="email"
            />
            {resetErr && (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {resetErr}
              </div>
            )}
            {resetMsg && (
              <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {resetMsg}
              </div>
            )}
            <Button
              type="submit"
              size="lg"
              className="w-full"
              loading={resetSending}
            >
              {resetSending ? "Sending…" : "Send Reset Link"}
            </Button>
            <button
              type="button"
              onClick={() => {
                setForgotMode(false);
                setResetErr("");
                setResetMsg("");
              }}
              className="block w-full text-center text-sm font-medium text-slate-500 hover:underline"
            >
              Back to Login
            </button>
          </form>
        )}
      </Card>
    </div>
  );
}
