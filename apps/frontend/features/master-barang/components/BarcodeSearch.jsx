"use client";
// Kartu input scan barcode / kode produk. Submit langsung mencari tanpa debounce.

import { Card, Button } from "@/components/ui";

export function BarcodeSearch({
  value,
  onChange,
  onSubmit,
  inputRef,
  showReset,
  onReset,
}) {
  return (
    <Card className="mb-3 shrink-0 border-2 border-brand-400 p-3">
      <form onSubmit={onSubmit} className="flex gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-lg bg-slate-50 px-3">
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
            placeholder="Scan barcode atau ketik kode produk lalu Enter…"
            className="flex-1 bg-transparent py-2 text-sm font-mono outline-none placeholder:text-slate-400"
          />
        </div>
        <Button type="submit" size="sm">
          Browse
        </Button>
        {showReset && (
          <Button type="button" size="sm" variant="secondary" onClick={onReset}>
            Reset
          </Button>
        )}
      </form>
    </Card>
  );
}
