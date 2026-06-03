"use client";
// SearchSelect — dropdown dapat dicari dengan opsi "buat baru" INLINE (creatable).
// Desain seragam dipakai untuk pilih Merk & Supplier. Untuk mode filter:
// set allowClear (opsi "Semua") dan allowCreate={false}.
//
// Perbaikan UX vs versi lama: tidak ada lagi tombol terpisah + input kedua untuk
// membuat data baru. Cukup ketik di kotak cari → muncul baris "Buat <noun>: '...'"
// di bawah daftar (atau tekan Enter).

import { useState, useRef, useMemo, useEffect } from "react";

export function SearchSelect({
  value,
  onChange,
  options = [],
  disabled = false,
  placeholder = "Pilih...",
  allowClear = false,
  clearLabel = "Semua",
  allowCreate = true,
  createNoun = "data",
  emptyText = "Tidak ada data ditemukan",
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapperRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    function onMouseDown(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 60);
  }, [open]);

  const list = Array.isArray(options) ? options : [];
  const q = search.trim();

  const filtered = useMemo(() => {
    const lc = q.toLowerCase();
    if (!lc) return list;
    return list.filter((o) => String(o).toLowerCase().includes(lc));
  }, [q, list]);

  const exactExists = list.some((o) => String(o).toLowerCase() === q.toLowerCase());
  const showCreate = allowCreate && q.length > 0 && !exactExists;

  function select(v) {
    onChange(v);
    setOpen(false);
    setSearch("");
  }

  function handleKeyDown(e) {
    if (e.key === "Escape") {
      setOpen(false);
      setSearch("");
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (showCreate) select(q);
      else if (filtered.length === 1) select(filtered[0]);
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => { if (!disabled) { setOpen((v) => !v); setSearch(""); } }}
        className={[
          "w-full rounded-lg border px-3 py-2 text-left text-sm transition-all duration-200",
          "focus:outline-none focus:ring-2 focus:ring-brand-500/30",
          disabled
            ? "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
            : open
            ? "border-brand-500 bg-white ring-2 ring-brand-500/20 text-slate-900"
            : "border-slate-200 bg-slate-50/50 hover:bg-white hover:border-slate-300 text-slate-900",
        ].join(" ")}
      >
        <span className="flex items-center justify-between gap-2">
          <span className={value ? "truncate text-slate-900" : "truncate text-slate-400"}>
            {value || placeholder}
          </span>
          {!disabled && (
            <svg
              className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </span>
      </button>

      {/* Popup */}
      {open && !disabled && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
          {/* Search */}
          <div className="border-b border-slate-100 p-2">
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Cari atau ketik ${createNoun}...`}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:bg-white"
            />
          </div>

          {/* List */}
          <div className="max-h-56 overflow-y-auto thin-scroll">
            {allowClear && (
              <button
                type="button"
                onClick={() => select("")}
                className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors hover:bg-slate-50 border-b border-slate-50 ${
                  !value ? "font-semibold text-brand-700 bg-brand-50/60" : "text-slate-500 italic"
                }`}
              >
                {clearLabel}
                {!value && <span className="text-brand-500 text-xs">✓</span>}
              </button>
            )}

            {filtered.length === 0 && !showCreate ? (
              <p className="px-4 py-4 text-center text-xs text-slate-400">{emptyText}</p>
            ) : (
              filtered.map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => select(o)}
                  className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors hover:bg-brand-50 ${
                    o === value
                      ? "bg-brand-50/60 font-semibold text-brand-700"
                      : "text-slate-700"
                  }`}
                >
                  <span className="truncate">{o}</span>
                  {o === value && <span className="text-brand-500 text-xs shrink-0">✓</span>}
                </button>
              ))
            )}

            {/* Baris buat baru — inline (desain baru, lebih rapi) */}
            {showCreate && (
              <button
                type="button"
                onClick={() => select(q)}
                className="flex w-full items-center gap-2.5 border-t border-slate-100 px-4 py-2.5 text-left text-sm transition-colors hover:bg-emerald-50/70"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
                  </svg>
                </span>
                <span className="truncate text-slate-600">
                  Buat {createNoun} baru:{" "}
                  <span className="font-semibold text-emerald-700">&quot;{q}&quot;</span>
                </span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
