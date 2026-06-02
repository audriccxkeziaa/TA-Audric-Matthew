"use client";
// Popup pemilih merk — dapat di-search, ada opsi "Buat Merk Baru" di paling atas.
// Dipakai di stok-masuk/ItemRow dan master-barang/ProductFormModal + ProductFilters.

import { useState, useRef, useMemo, useEffect } from "react";

export function MerkPopup({
  value,
  onChange,
  merkList = [],
  disabled = false,
  placeholder = "Pilih merk...",
  allowClear = false,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [newMerk, setNewMerk] = useState("");
  const wrapperRef = useRef(null);
  const searchRef = useRef(null);
  const newMerkRef = useRef(null);

  useEffect(() => {
    function onMouseDown(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
        setCreating(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 60);
  }, [open]);

  useEffect(() => {
    if (creating) setTimeout(() => newMerkRef.current?.focus(), 60);
  }, [creating]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return merkList;
    return merkList.filter((m) => m.toLowerCase().includes(q));
  }, [search, merkList]);

  function handleSelect(m) {
    onChange(m);
    setOpen(false);
    setCreating(false);
    setSearch("");
    setNewMerk("");
  }

  function handleSaveNew() {
    const trimmed = newMerk.trim();
    if (!trimmed) return;
    onChange(trimmed);
    setOpen(false);
    setCreating(false);
    setSearch("");
    setNewMerk("");
  }

  function handleOpen() {
    if (disabled) return;
    setOpen((v) => !v);
    setCreating(false);
    setSearch("");
  }

  return (
    <div ref={wrapperRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={handleOpen}
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
          <span className={value ? "text-slate-900" : "text-slate-400"}>
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
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <span className="text-xs font-semibold text-slate-600">Pilih Merk</span>
            <button
              type="button"
              onClick={() => { setOpen(false); setCreating(false); setSearch(""); }}
              className="rounded p-0.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Search */}
          <div className="border-b border-slate-100 p-2">
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari merk..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:bg-white"
            />
          </div>

          {/* Buat Merk Baru — always first */}
          <div className="border-b border-slate-100 p-2">
            {!creating ? (
              <button
                type="button"
                onClick={() => { setCreating(true); setNewMerk(search); }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-emerald-600 hover:bg-emerald-50 transition-colors"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">+</span>
                Buat Merk Baru
              </button>
            ) : (
              <div className="flex gap-2">
                <input
                  ref={newMerkRef}
                  value={newMerk}
                  onChange={(e) => setNewMerk(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); handleSaveNew(); }
                    if (e.key === "Escape") setCreating(false);
                  }}
                  placeholder="Nama merk baru..."
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:bg-white"
                />
                <button
                  type="button"
                  onClick={handleSaveNew}
                  disabled={!newMerk.trim()}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Simpan
                </button>
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  Batal
                </button>
              </div>
            )}
          </div>

          {/* List */}
          <div className="max-h-52 overflow-y-auto thin-scroll">
            {allowClear && (
              <button
                type="button"
                onClick={() => handleSelect("")}
                className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors hover:bg-slate-50 border-b border-slate-50 ${
                  !value ? "font-semibold text-brand-700 bg-brand-50/60" : "text-slate-500 italic"
                }`}
              >
                Semua Merk
                {!value && <span className="text-brand-500 text-xs">✓</span>}
              </button>
            )}
            {filtered.length === 0 ? (
              <p className="px-4 py-4 text-center text-xs text-slate-400">
                Tidak ada merk ditemukan
              </p>
            ) : (
              filtered.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleSelect(m)}
                  className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors hover:bg-brand-50 ${
                    m === value
                      ? "bg-brand-50/60 font-semibold text-brand-700"
                      : "text-slate-700"
                  }`}
                >
                  {m}
                  {m === value && <span className="text-brand-500 text-xs">✓</span>}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
