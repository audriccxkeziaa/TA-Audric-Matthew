"use client";

import { useEffect, useRef, useState } from "react";

const STEPS = [
  "Memverifikasi kredensial",
  "Membangun sesi",
  "Memuat modul POS",
  "Sistem siap",
];

export default function LoginLoadingScreen({
  role,
  userName,
  durationMs = 1800,
  onDone,
}) {
  const [progress, setProgress] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  const startedAt = useRef(Date.now());

  const tagline =
    role === "admin"
      ? "Owner / Administrator"
      : role === "kasir"
      ? "Kasir"
      : "Please wait...";

  useEffect(() => {
    const tick = setInterval(() => {
      const elapsed = Date.now() - startedAt.current;
      const pct = Math.min(100, (elapsed / durationMs) * 100);
      setProgress(pct);
      setStepIdx(
        Math.min(STEPS.length - 1, Math.floor((pct / 100) * STEPS.length))
      );
      if (pct >= 100) {
        clearInterval(tick);
        setTimeout(() => onDone?.(), 200);
      }
    }, 30);
    return () => clearInterval(tick);
  }, [durationMs, onDone]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900">
      <div className="w-full max-w-sm px-6 text-center">
        {/* Brand */}
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-slate-400">
          CV Asia Jaya Maju
        </p>
        <h1 className="mt-1 text-xl font-bold text-white">POS System</h1>
        <p className="mt-0.5 text-sm text-slate-400">{tagline}</p>

        {userName && (
          <p className="mt-4 text-sm text-slate-300">
            Welcome,{" "}
            <span className="font-semibold text-white">{userName}</span>
          </p>
        )}

        {/* Progress bar */}
        <div className="mx-auto mt-6 h-2 w-full overflow-hidden rounded-full bg-slate-700">
          <div
            className="h-full rounded-full bg-brand-500 transition-[width] duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>

        <p className="mt-3 font-mono text-xs text-slate-500">
          {Math.floor(progress)}%
        </p>
      </div>
    </div>
  );
}
