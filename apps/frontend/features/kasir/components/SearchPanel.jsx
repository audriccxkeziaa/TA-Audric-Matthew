"use client";
// Panel Browse produk (F2) — menampilkan SEMUA barang, di-render
// ter-virtualisasi (ringan walau ribuan baris). Filter nama/kode + merk
// dilakukan di sisi klien (instan). Produk nonaktif (discontinue) / habis
// tetap tampil tapi tidak bisa dipilih.

import { Card, Badge, Spinner } from "@/components/ui";
import { VirtualList } from "@/components/VirtualList";
import { rupiah, angka } from "@/lib/format";

const ROW_H = 64; // tinggi tetap tiap baris (px) — wajib agar virtualisasi presisi
const LIST_MAX_H = 380;

export function SearchPanel({
  q,
  onQChange,
  merkFilter = "",
  onMerkChange,
  merkList = [],
  onClose,
  searchRef,
  results,
  searchFetching,
  onPick,
}) {
  return (
    <Card className="mt-2 shrink-0 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={searchRef}
          placeholder="Cari nama atau kode barang…"
          value={q}
          onChange={(e) => onQChange(e.target.value)}
          className="min-w-0 flex-1 basis-40 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
        />
        <select
          value={merkFilter}
          onChange={(e) => onMerkChange(e.target.value)}
          title="Filter merk"
          className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500 sm:w-44"
        >
          <option value="">Semua merk</option>
          {merkList.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <button
          onClick={onClose}
          className="ml-auto text-xs text-slate-500 hover:underline sm:ml-0"
        >
          Close
        </button>
      </div>

      <p className="mt-1 text-[11px] text-slate-400">
        {searchFetching ? "Memuat katalog…" : `${angka(results.length)} produk`}
      </p>

      <div className="mt-2">
        {searchFetching ? (
          <div className="py-6">
            <Spinner label="Memuat katalog…" />
          </div>
        ) : results.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-400">Tidak ada hasil</p>
        ) : (
          <VirtualList
            items={results}
            rowHeight={ROW_H}
            height={Math.min(ROW_H * results.length, LIST_MAX_H)}
            renderRow={(p) => {
              const habis = Number(p.stok) === 0;
              const discontinue = p.status === "nonaktif";
              const disabled = habis || discontinue;
              return (
                <button
                  key={p.id}
                  disabled={disabled}
                  onClick={() => !disabled && onPick(p)}
                  style={{ height: ROW_H }}
                  className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3 text-left transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                      <span className="truncate">{p.nama_barang}</span>
                      {discontinue && <Badge tone="slate">Discontinue</Badge>}
                    </p>
                    <p className="truncate text-xs text-slate-400">
                      {p.kode_barang} · {p.merk || "-"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold">{rupiah(p.harga_jual)}</p>
                    <p className="text-[11px] text-slate-400">
                      {discontinue ? "Discontinue" : habis ? "Habis" : `Stok ${angka(p.stok)}`}
                    </p>
                  </div>
                </button>
              );
            }}
          />
        )}
      </div>
    </Card>
  );
}
