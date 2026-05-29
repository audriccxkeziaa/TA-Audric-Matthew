"use client";
// Modal detail stok negatif (klik kartu "Stok Negatif"). Bila count=0 →
// pesan sukses (bukti R1+R3). Fetch list hanya bila count > 0.

import { useQuery } from "@tanstack/react-query";
import { productsApi } from "@/lib/api";
import { angka } from "@/lib/format";
import { Modal, Spinner, EmptyState } from "@/components/ui";

export function NegativeStockModal({ open, onClose, count }) {
  const q = useQuery({
    queryKey: ["products-negative"],
    queryFn: () => productsApi.list({ limit: 200, status: "all" }),
    enabled: open && count > 0,
  });
  const rows = (q.data?.data || []).filter((p) => Number(p.stok) < 0);

  return (
    <Modal open={open} onClose={onClose} title="Detail Stok Negatif" width="max-w-2xl">
      {count === 0 ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 text-center">
          <div className="mx-auto mb-2 text-3xl">✓</div>
          <p className="text-base font-semibold text-emerald-700">
            Tidak ada stok negatif
          </p>
          <p className="mt-1 text-sm text-emerald-600">
            Bukti aturan <b>R1</b> (Pencegahan Stok Negatif) dan <b>R3</b>{" "}
            (Pembaruan Stok Terpusat) berhasil menjaga integritas data.
          </p>
        </div>
      ) : q.isLoading ? (
        <Spinner label="Memuat data..." />
      ) : rows.length === 0 ? (
        <EmptyState title="Stok negatif sudah teratasi" />
      ) : (
        <div className="rounded-lg border border-red-200 bg-red-50">
          <div className="border-b border-red-200 px-4 py-2 text-sm font-semibold text-red-700">
            ⚠ {rows.length} barang memiliki stok negatif — segera diinvestigasi
          </div>
          <table className="w-full text-sm">
            <thead className="bg-red-100/50 text-left text-xs uppercase text-red-700">
              <tr>
                <th className="px-3 py-2">Kode</th>
                <th className="px-3 py-2">Nama Barang</th>
                <th className="px-3 py-2 text-right">Stok</th>
                <th className="px-3 py-2 text-right">Min</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-red-100">
              {rows.map((p) => (
                <tr key={p.id}>
                  <td className="px-3 py-2 font-mono text-xs">{p.kode_barang}</td>
                  <td className="px-3 py-2">{p.nama_barang}</td>
                  <td className="px-3 py-2 text-right font-bold text-red-700">
                    {angka(p.stok)}
                  </td>
                  <td className="px-3 py-2 text-right">{angka(p.min_stock)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
