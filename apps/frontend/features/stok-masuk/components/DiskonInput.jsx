"use client";
// Input diskon fleksibel (% atau nominal Rp). CATATAN: komponen ini tidak
// dirender di mana pun pada versi asli (dead code) — dipertahankan apa adanya
// agar tidak ada yang hilang; bisa dihapus bila memang tak dipakai.

import { useState } from "react";

export function DiskonInput({ diskonPersen, hargaBeli, fieldClass, onPatch }) {
  const [mode, setMode] = useState("persen"); // "persen" | "rupiah"
  const [rpValue, setRpValue] = useState("");

  const toggleMode = () => {
    if (mode === "persen") {
      const rp = hargaBeli > 0 ? Math.round((diskonPersen / 100) * hargaBeli) : 0;
      setRpValue(rp > 0 ? String(rp) : "");
      setMode("rupiah");
    } else {
      setMode("persen");
    }
  };

  const onPersenChange = (e) => {
    const v = Math.max(0, Math.min(100, Number(e.target.value) || 0));
    onPatch({ diskon_persen: v });
  };

  const onRupiahChange = (e) => {
    const v = e.target.value;
    setRpValue(v);
    const num = Number(v) || 0;
    if (hargaBeli > 0) {
      const pct = Math.min(100, Math.max(0, (num / hargaBeli) * 100));
      onPatch({ diskon_persen: Math.round(pct * 100) / 100 });
    }
  };

  return (
    <label className="flex-1 min-w-[120px]">
      <span className="mb-0.5 block text-[11px] font-medium text-slate-500">
        Diskon
      </span>
      <div className="flex items-stretch gap-0">
        <input
          type="number"
          min="0"
          max={mode === "persen" ? 100 : undefined}
          step={mode === "persen" ? 1 : 100}
          value={mode === "persen" ? (diskonPersen || "") : rpValue}
          onChange={mode === "persen" ? onPersenChange : onRupiahChange}
          placeholder={mode === "persen" ? "0" : "0"}
          className={`w-full rounded-l-lg border border-r-0 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-brand-500 ${
            fieldClass || "border-slate-300"
          }`}
        />
        <button
          type="button"
          onClick={toggleMode}
          className="shrink-0 rounded-r-lg border border-slate-300 bg-slate-100 px-2 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
          title={mode === "persen" ? "Klik untuk input nominal Rp" : "Klik untuk input persen %"}
        >
          {mode === "persen" ? "%" : "Rp"}
        </button>
      </div>
    </label>
  );
}
