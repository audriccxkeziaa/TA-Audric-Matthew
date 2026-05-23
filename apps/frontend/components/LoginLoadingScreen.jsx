"use client";
// =================================================================
// components/LoginLoadingScreen.jsx
// =================================================================
// Loading bertema "control room" yang muncul SETELAH user menekan
// tombol "Masuk". Layout horizontal ala referensi `loading.jpg`
// (progress bar + ikon di kanan), tapi dengan tampilan profesional:
// grid latar, log sistem berjalan, dan indikator step booting.
// =================================================================

import { useEffect, useRef, useState } from "react";

const BOOT_STEPS = [
  { key: "auth",     label: "Memverifikasi kredensial",     detail: "auth.verify_token()" },
  { key: "session",  label: "Membangun sesi pengguna",      detail: "session.bootstrap()" },
  { key: "profile",  label: "Memuat profil & peran (RBAC)", detail: "rbac.resolve_role()" },
  { key: "modules",  label: "Menyiapkan modul POS",         detail: "modules.preload(...)" },
  { key: "ready",    label: "Sistem siap",                  detail: "ui.handoff()" },
];

export default function LoginLoadingScreen({
  role,            // 'admin' | 'kasir' | null
  userName,        // optional, ditampilkan kalau ada
  durationMs = 1800,
  onDone,
}) {
  const [progress, setProgress] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  const [log, setLog] = useState([]);
  const startedAt = useRef(Date.now());
  const seenStep = useRef(-1);

  // Tagline berdasarkan role yang akan dimasuki
  const tagline =
    role === "admin"
      ? "Owner / Administrator Console"
      : role === "kasir"
      ? "Cashier Operating Terminal"
      : "Authenticating...";

  useEffect(() => {
    const tick = setInterval(() => {
      const elapsed = Date.now() - startedAt.current;
      const pct = Math.min(100, (elapsed / durationMs) * 100);
      setProgress(pct);

      const idx = Math.min(
        BOOT_STEPS.length - 1,
        Math.floor((pct / 100) * BOOT_STEPS.length)
      );
      setStepIdx(idx);

      // Tambahkan baris log saat step baru ter-trigger
      if (idx > seenStep.current) {
        seenStep.current = idx;
        const step = BOOT_STEPS[idx];
        const ts = new Date().toLocaleTimeString("id-ID", { hour12: false });
        setLog((prev) => [
          ...prev,
          { ts, text: `[${step.key.toUpperCase()}] ${step.detail} ✓` },
        ]);
      }

      if (pct >= 100) {
        clearInterval(tick);
        setTimeout(() => onDone?.(), 280);
      }
    }, 30);
    return () => clearInterval(tick);
  }, [durationMs, onDone]);

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden bg-slate-950 text-slate-100">
      {/* Grid latar — efek "blueprint" */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(99,102,241,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.35) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage:
            "radial-gradient(ellipse at center, black 35%, transparent 75%)",
        }}
      />
      {/* Glow oranye lembut */}
      <div className="pointer-events-none absolute -left-32 top-1/3 h-72 w-72 rounded-full bg-amber-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 bottom-1/3 h-72 w-72 rounded-full bg-indigo-500/30 blur-3xl" />

      {/* Header pojok kiri — indikator status */}
      <div className="absolute left-6 top-6 flex items-center gap-2 font-mono text-[11px] tracking-widest text-emerald-300/80">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
        </span>
        SYSTEM ONLINE
      </div>
      <div className="absolute right-6 top-6 font-mono text-[11px] tracking-widest text-slate-400">
        AJM-POS · v1.0 · {role ? role.toUpperCase() : "AUTH"}
      </div>

      {/* Konten utama */}
      <div className="relative z-10 w-full max-w-2xl px-6 text-center">
        {/* Brand */}
        <div className="mb-1 font-mono text-[11px] uppercase tracking-[0.4em] text-indigo-300/80">
          CV Asia Jaya Maju
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Booting POS Workstation
        </h1>
        <p className="mt-1 text-sm text-slate-400">{tagline}</p>
        {userName && (
          <p className="mt-3 text-sm text-slate-300">
            Selamat datang,{" "}
            <span className="font-semibold text-amber-300">{userName}</span>
          </p>
        )}

        {/* Progress bar + ikon (mengikuti referensi loading.jpg) */}
        <div className="mx-auto mt-8 flex w-full max-w-xl items-center gap-3">
          <div className="relative flex-1 overflow-hidden rounded-xl border border-indigo-400/40 bg-slate-900/70 p-1 shadow-[0_0_24px_-4px_rgba(99,102,241,0.6)]">
            <div className="relative h-6 overflow-hidden rounded-md bg-slate-800/80">
              {/* Bar utama */}
              <div
                className="absolute inset-y-0 left-0 rounded-md bg-gradient-to-r from-indigo-500 via-fuchsia-400 to-amber-300 transition-[width] duration-100 ease-linear"
                style={{ width: `${progress}%` }}
              />
              {/* Pola garis pada bar (animated stripes) */}
              <div
                className="absolute inset-y-0 left-0 rounded-md opacity-30 transition-[width] duration-100 ease-linear"
                style={{
                  width: `${progress}%`,
                  backgroundImage:
                    "repeating-linear-gradient(45deg, rgba(255,255,255,0.35) 0 6px, transparent 6px 12px)",
                  animation: "ajm-stripes 1s linear infinite",
                }}
              />
              {/* Persentase di tengah bar */}
              <div className="absolute inset-0 flex items-center justify-center font-mono text-[11px] font-bold tracking-widest text-white drop-shadow">
                {Math.floor(progress).toString().padStart(3, "0")}%
              </div>
            </div>
          </div>
          {/* Ikon di kanan bar — analog dengan beruang di referensi */}
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-indigo-400/40 bg-slate-900/70 shadow-[0_0_24px_-4px_rgba(99,102,241,0.6)]">
            <span className="absolute inset-0 animate-ping rounded-xl bg-indigo-500/20" />
            <svg
              className="relative h-6 w-6 animate-spin text-amber-300"
              style={{ animationDuration: "1.6s" }}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" opacity="0.25" />
              <path d="M21 12a9 9 0 0 0-9-9" />
            </svg>
          </div>
        </div>

        {/* Step pill list */}
        <div className="mx-auto mt-6 flex max-w-xl flex-wrap items-center justify-center gap-2">
          {BOOT_STEPS.map((s, i) => {
            const done = i < stepIdx;
            const active = i === stepIdx;
            return (
              <span
                key={s.key}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition ${
                  done
                    ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                    : active
                    ? "border-amber-300/50 bg-amber-300/10 text-amber-200"
                    : "border-slate-700 bg-slate-900/40 text-slate-500"
                }`}
              >
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${
                    done
                      ? "bg-emerald-400"
                      : active
                      ? "animate-pulse bg-amber-300"
                      : "bg-slate-600"
                  }`}
                />
                {s.label}
              </span>
            );
          })}
        </div>

        {/* Konsol log */}
        <div className="mx-auto mt-6 h-[120px] max-w-xl overflow-hidden rounded-lg border border-slate-700/70 bg-slate-900/60 p-3 text-left font-mono text-[11px] leading-relaxed text-slate-300 shadow-inner">
          {log.length === 0 ? (
            <p className="text-slate-500">// menunggu instruksi sistem...</p>
          ) : (
            log.slice(-5).map((l, i) => (
              <div key={`${l.ts}-${i}`} className="flex gap-2">
                <span className="text-slate-500">{l.ts}</span>
                <span className="text-emerald-300">{l.text}</span>
              </div>
            ))
          )}
          <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-emerald-400/80 align-middle" />
        </div>
      </div>

      <p className="absolute bottom-5 left-1/2 -translate-x-1/2 font-mono text-[10px] uppercase tracking-[0.3em] text-slate-500">
        Skripsi S1 Informatika · UK Petra · Audric Matthew Wirawan
      </p>

      {/* Animasi keyframes inline (tailwind tidak punya bawaan untuk stripes) */}
      <style jsx>{`
        @keyframes ajm-stripes {
          from {
            background-position: 0 0;
          }
          to {
            background-position: 24px 0;
          }
        }
      `}</style>
    </div>
  );
}
