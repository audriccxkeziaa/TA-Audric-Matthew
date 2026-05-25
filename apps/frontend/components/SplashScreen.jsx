"use client";

import { useEffect, useRef, useState } from "react";

const MESSAGES = [
  "Menyiapkan sistem...",
  "Memuat data...",
  "Hampir siap...",
];

export default function SplashScreen({ onDone, durationMs = 2500 }) {
  const [progress, setProgress] = useState(0);
  const [msgIdx, setMsgIdx] = useState(0);
  const start = useRef(Date.now());

  useEffect(() => {
    const tick = setInterval(() => {
      const pct = Math.min(100, ((Date.now() - start.current) / durationMs) * 100);
      setProgress(pct);
      setMsgIdx(Math.min(MESSAGES.length - 1, Math.floor((pct / 100) * MESSAGES.length)));
      if (pct >= 100) {
        clearInterval(tick);
        setTimeout(() => onDone?.(), 200);
      }
    }, 30);
    return () => clearInterval(tick);
  }, [onDone, durationMs]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white">
      <div className="w-full max-w-xs px-6 text-center">
        <h1 className="text-2xl font-bold text-slate-800">CV Asia Jaya Maju</h1>
        <p className="mt-1 text-sm text-slate-400">Point of Sale · Suku Cadang Motor</p>

        <div className="mx-auto mt-8 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-brand-500 transition-[width] duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>

        <p className="mt-3 text-sm text-slate-500">{MESSAGES[msgIdx]}</p>
        <p className="mt-0.5 font-mono text-xs text-slate-300">{Math.floor(progress)}%</p>
      </div>
    </div>
  );
}
