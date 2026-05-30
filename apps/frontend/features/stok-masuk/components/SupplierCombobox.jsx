"use client";
// Combobox nama supplier: pilih dari riwayat atau ketik supplier baru.

import { useState, useRef, useMemo, useEffect } from "react";

export function SupplierCombobox({ value, onChange, supplierList, className }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return supplierList;
    return supplierList.filter((s) => s.toLowerCase().includes(q));
  }, [search, supplierList]);

  const showAddNew =
    search.trim() &&
    !supplierList.some((s) => s.toLowerCase() === search.trim().toLowerCase());

  return (
    <div ref={wrapperRef} className="relative">
      <input
        value={value || ""}
        onChange={(e) => { onChange(e.target.value); setSearch(e.target.value); setOpen(true); }}
        onFocus={() => { setSearch(value || ""); setOpen(true); }}
        placeholder="Pilih atau ketik nama supplier baru"
        className={className}
      />
      {open && (
        <div className="absolute z-30 mt-0.5 max-h-44 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {filtered.map((s) => (
            <button
              key={s}
              type="button"
              className={`w-full px-3 py-1.5 text-left text-sm hover:bg-brand-50 ${s === value ? "bg-brand-50 font-medium text-brand-700" : "text-slate-700"}`}
              onClick={() => { onChange(s); setOpen(false); }}
            >
              {s}
            </button>
          ))}
          {showAddNew && (
            <button
              type="button"
              className="w-full border-t border-slate-100 px-3 py-1.5 text-left text-sm font-medium text-emerald-600 hover:bg-emerald-50"
              onClick={() => { onChange(search.trim()); setOpen(false); }}
            >
              + Tambah supplier baru &quot;{search.trim()}&quot;
            </button>
          )}
          {filtered.length === 0 && !showAddNew && (
            <p className="px-3 py-2 text-xs text-slate-400">Tidak ada supplier ditemukan</p>
          )}
        </div>
      )}
    </div>
  );
}
