"use client";
// =================================================================
// components/ProductPicker.jsx — Modal pilih produk dari katalog
// =================================================================
// Dipakai di /stok-masuk ketika kandidat Levenshtein tidak cocok dan
// user ingin memilih produk lain secara manual.
// =================================================================

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { productsApi } from "@/lib/api";
import { useDebounce } from "@/hooks/useDebounce";
import { rupiah, angka } from "@/lib/format";
import { Modal, Spinner, EmptyState } from "@/components/ui";

export default function ProductPicker({ open, onClose, onSelect }) {
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 300);

  const { data, isFetching } = useQuery({
    queryKey: ["picker-products", debouncedQ],
    queryFn: () =>
      productsApi.list({ q: debouncedQ, status: "aktif", limit: 30 }),
    enabled: open,
  });
  const results = data?.data || [];

  return (
    <Modal open={open} onClose={onClose} title="Pilih Produk dari Katalog">
      <input
        autoFocus
        placeholder="Cari nama / kode barang..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
      />
      <div className="mt-3 max-h-80 space-y-1.5 overflow-y-auto thin-scroll">
        {isFetching && (
          <div className="py-6">
            <Spinner label="Mencari..." />
          </div>
        )}
        {!isFetching && results.length === 0 && (
          <EmptyState title="Tidak ada produk" />
        )}
        {!isFetching &&
          results.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                onSelect(p);
                onClose();
              }}
              className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-left hover:border-brand-400 hover:bg-brand-50"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">
                  {p.nama_barang}
                </p>
                <p className="text-xs text-slate-400">
                  {p.kode_barang} · {p.merk || "-"}
                </p>
              </div>
              <div className="text-right text-xs text-slate-500">
                <p>Stok {angka(p.stok)}</p>
                <p>{rupiah(p.harga_beli)}</p>
              </div>
            </button>
          ))}
      </div>
    </Modal>
  );
}
