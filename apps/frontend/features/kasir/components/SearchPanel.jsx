"use client";
// Panel pencarian produk (F2) — KOSONG secara default: produk baru tampil
// setelah kasir mengetik nama/kode ATAU memilih merk. Produk nonaktif
// (discontinue) ditampilkan tapi tidak bisa dipilih. Responsif untuk HP.

import { Card, Badge, Spinner } from "@/components/ui";
import { rupiah, angka } from "@/lib/format";

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
  // Daftar produk hanya muncul bila ada kata kunci atau merk dipilih.
  const active = (q && q.trim().length > 0) || !!merkFilter;

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

      {!active ? (
        <p className="mt-3 py-3 text-center text-xs text-slate-400">
          Ketik nama / kode barang atau pilih merk untuk menampilkan produk.
        </p>
      ) : (
        <>
          <p className="mt-1 text-[11px] text-slate-400">
            {searchFetching ? "Memuat…" : `${results.length} produk ditemukan`}
          </p>
          <div className="mt-2 max-h-[60vh] space-y-1 overflow-y-auto thin-scroll">
            {searchFetching && (
              <div className="py-3">
                <Spinner label="Mencari…" />
              </div>
            )}
            {!searchFetching && results.length === 0 && (
              <p className="py-2 text-center text-xs text-slate-400">
                Tidak ada hasil
              </p>
            )}
            {!searchFetching &&
              results.map((p) => {
                const habis = Number(p.stok) === 0;
                const discontinue = p.status === "nonaktif";
                const disabled = habis || discontinue;
                return (
                  <button
                    key={p.id}
                    disabled={disabled}
                    onClick={() => !disabled && onPick(p)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-left transition hover:border-brand-400 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-1.5 truncate text-sm font-medium text-slate-800">
                        <span>{p.nama_barang}</span>
                        {discontinue && <Badge tone="slate">Discontinue</Badge>}
                      </p>
                      <p className="text-xs text-slate-400">
                        {p.kode_barang} · {p.merk || "-"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{rupiah(p.harga_jual)}</p>
                      <p className="text-[11px] text-slate-400">Beli: {rupiah(p.harga_beli)}</p>
                      <p className="text-xs">
                        {discontinue ? (
                          <Badge tone="slate">Discontinue</Badge>
                        ) : habis ? (
                          <Badge tone="red">Habis</Badge>
                        ) : (
                          <span className="text-slate-400">Stok {angka(p.stok)}</span>
                        )}
                      </p>
                    </div>
                  </button>
                );
              })}
          </div>
        </>
      )}
    </Card>
  );
}
