"use client";
// =================================================================
// components/SplashScreen.jsx — Layar pembuka animasi sebelum login
// =================================================================
// Progress bar 0→100 dalam ~2.5 detik dengan pesan lucu bergantian,
// ikon kunci yang berputar, dan kelap-kelip lampu sein motor.
// =================================================================

import { useEffect, useState } from "react";

const FUN_MESSAGES = [
  "Memanaskan mesin kasir…",
  "Mengencangkan baut-baut server…",
  "Menghitung stok oli…",
  "Mengecek tekanan ban OCR…",
  "Memoles helm sang admin…",
  "Siap berangkat! 🏍️",
];

export default function SplashScreen({ onDone, durationMs = 2500 }) {
  const [progress, setProgress] = useState(0);
  const [msgIdx, setMsgIdx] = useState(0);
  const [blink, setBlink] = useState(true);

  useEffect(() => {
    const start = Date.now();
    const tick = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, (elapsed / durationMs) * 100);
      setProgress(pct);
      const idx = Math.min(
        FUN_MESSAGES.length - 1,
        Math.floor((pct / 100) * FUN_MESSAGES.length)
      );
      setMsgIdx(idx);
      if (pct >= 100) {
        clearInterval(tick);
        setTimeout(() => onDone?.(), 250);
      }
    }, 30);
    const blinker = setInterval(() => setBlink((b) => !b), 500);
    return () => {
      clearInterval(tick);
      clearInterval(blinker);
    };
  }, [onDone, durationMs]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 text-white">
      {/* Lampu sein motor — kelap-kelip */}
      <div className="absolute left-8 top-8 flex items-center gap-2">
        <span
          className={`block h-3 w-3 rounded-full transition-opacity ${
            blink ? "bg-amber-300 opacity-100 shadow-[0_0_12px_4px_rgba(251,191,36,0.7)]" : "bg-amber-300 opacity-20"
          }`}
        />
        <span className="text-xs uppercase tracking-widest text-white/60">
          On / Booting
        </span>
      </div>
      <div className="absolute right-8 top-8 flex items-center gap-2">
        <span className="text-xs uppercase tracking-widest text-white/60">
          v1.0
        </span>
        <span
          className={`block h-3 w-3 rounded-full transition-opacity ${
            blink ? "bg-amber-300 opacity-20" : "bg-amber-300 opacity-100 shadow-[0_0_12px_4px_rgba(251,191,36,0.7)]"
          }`}
        />
      </div>

      {/* Brand */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight drop-shadow">
          CV Asia Jaya Maju
        </h1>
        <p className="mt-1 text-sm text-white/70">
          Point of Sale Suku Cadang Motor
        </p>
      </div>

      {/* Ikon kunci pas — berputar */}
      <div className="relative mb-8">
        <div className="absolute inset-0 animate-ping rounded-full bg-white/10" />
        <svg
          className="relative h-20 w-20 animate-spin text-white"
          style={{ animationDuration: "1.8s" }}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
        </svg>
      </div>

      {/* Progress bar */}
      <div className="w-80 max-w-[80vw]">
        <div className="overflow-hidden rounded-full border border-white/30 bg-white/10 shadow-inner">
          <div
            className="h-3 rounded-full bg-gradient-to-r from-amber-300 via-white to-amber-300 transition-[width] duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-3 min-h-[1.25rem] text-center text-sm text-white/90 transition-opacity">
          {FUN_MESSAGES[msgIdx]}
        </p>
        <p className="mt-0.5 text-center font-mono text-[11px] text-white/50">
          {Math.floor(progress)}%
        </p>
      </div>

      <p className="absolute bottom-6 text-[11px] text-white/40">
        Skripsi S1 Informatika · UK Petra · Audric Matthew Wirawan
      </p>
    </div>
  );
}
