"use client";
// /reset-password — Halaman set password baru dari link email recovery.
// Alur: admin klik "Lupa Password?" di /login → email reset dikirim Supabase →
// link mengarah ke sini dengan token di URL hash → user isi password baru.
// Token ditangkap otomatis oleh klien Supabase (detectSessionInUrl + implicit).

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button, Input, Card, Spinner } from "@/components/ui";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true); // sedang deteksi sesi recovery
  const [ready, setReady] = useState(false); // link valid, boleh ganti password
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  // Deteksi sesi recovery dari URL (hash token) saat halaman dibuka.
  useEffect(() => {
    if (!supabase) {
      setChecking(false);
      return;
    }
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setReady(true);
        setChecking(false);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) {
        setReady(true);
        setChecking(false);
      }
    });
    // Kalau token tidak terbaca dalam 4 detik → anggap link tidak valid.
    const t = setTimeout(() => setChecking(false), 4000);
    return () => {
      sub?.subscription?.unsubscribe();
      clearTimeout(t);
    };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setErr("");
    if (pw.length < 6) {
      setErr("Password minimal 6 karakter");
      return;
    }
    if (pw !== pw2) {
      setErr("Konfirmasi password tidak cocok");
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setSaving(false);
    if (error) {
      setErr(error.message || "Gagal mengubah password");
      return;
    }
    // Bersihkan sesi recovery agar user login ulang dengan password baru.
    await supabase.auth.signOut().catch(() => {});
    setDone(true);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900 p-4">
      <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-brand-500/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-brand-400/20 blur-3xl" />

      <Card className="relative w-full max-w-sm p-7 shadow-pop">
        <h1 className="mb-1 text-lg font-bold tracking-tight text-slate-900">
          Reset Password
        </h1>

        {checking && (
          <div className="py-8">
            <Spinner label="Memverifikasi link…" />
          </div>
        )}

        {!checking && !ready && !done && (
          <div className="mt-3 space-y-4">
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              Link reset tidak valid atau sudah kedaluwarsa. Silakan minta link
              baru dari halaman login.
            </div>
            <Button
              className="w-full"
              variant="secondary"
              onClick={() => router.replace("/login")}
            >
              Back to Login
            </Button>
          </div>
        )}

        {!checking && ready && !done && (
          <form onSubmit={handleSubmit} className="mt-3 space-y-4">
            <p className="text-sm text-slate-500">
              Masukkan password baru untuk akun Anda.
            </p>
            <div className="relative">
              <Input
                label="Password Baru"
                type={showPw ? "text" : "password"}
                placeholder="••••••••"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPw((p) => !p)}
                className="absolute right-3 top-[37px] text-slate-400 transition-colors hover:text-slate-600"
                tabIndex={-1}
              >
                {showPw ? "Hide" : "Show"}
              </button>
            </div>
            <Input
              label="Konfirmasi Password"
              type={showPw ? "text" : "password"}
              placeholder="••••••••"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              autoComplete="new-password"
            />
            {err && (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {err}
              </div>
            )}
            <Button type="submit" size="lg" className="w-full" loading={saving}>
              {saving ? "Saving…" : "Save New Password"}
            </Button>
          </form>
        )}

        {done && (
          <div className="mt-3 space-y-4">
            <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              Password berhasil diubah. Silakan login dengan password baru.
            </div>
            <Button className="w-full" onClick={() => router.replace("/login")}>
              Back to Login
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
