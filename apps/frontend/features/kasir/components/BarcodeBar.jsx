"use client";
// Input utama POS: scan barcode / ketik kode lalu Enter (F1). Tombol Browse (F2).

import { Card, Button } from "@/components/ui";

export function BarcodeBar({ value, onChange, onSubmit, inputRef, onBrowse }) {
  return (
    <Card className="shrink-0 ring-2 ring-brand-500/70 p-3">
      <form onSubmit={onSubmit} className="flex flex-wrap gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 transition focus-within:border-brand-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-500/30">
          <svg
            className="h-5 w-5 shrink-0 text-slate-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M3 5v14M7 5v14M11 5v14M15 5v14M19 5v14" />
          </svg>
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Scan barcode atau ketik kode produk lalu Enter… (F1)"
            autoFocus
            className="flex-1 bg-transparent py-2.5 text-base font-mono outline-none placeholder:text-slate-400"
          />
          <kbd className="hidden rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 sm:inline">
            F1
          </kbd>
        </div>
        <Button type="submit" size="lg">
          Add
        </Button>
        <Button type="button" variant="secondary" size="lg" onClick={onBrowse}>
          <span className="hidden sm:inline">Browse (F2)</span>
          <span className="sm:hidden">Browse</span>
        </Button>
      </form>
    </Card>
  );
}
