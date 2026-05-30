"use client";
// Kartu ringkasan laporan (berbeda untuk penjualan vs pembelian).

import { StatCard } from "@/components/ui";
import { rupiah, angka } from "@/lib/format";

export function LaporanSummary({ isSales, summary, isKasir = false }) {
  return (
    <div className="mb-3 grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-4">
      {isSales ? (
        <>
          <StatCard label="Total Transaksi" value={angka(summary.total_transactions || 0)} />
          <StatCard label="Total Item Terjual" value={angka(summary.total_qty || 0)} />
          <StatCard label="Total Baris" value={angka(summary.total_items || 0)} />
          {/* Revenue disembunyikan untuk kasir — data sensitif hanya untuk admin */}
          {!isKasir && (
            <StatCard label="Total Revenue" value={rupiah(summary.total_revenue || 0)} tone="good" />
          )}
        </>
      ) : (
        <>
          <StatCard label="Total Nota" value={angka(summary.total_purchases || 0)} />
          <StatCard label="Total Item Masuk" value={angka(summary.total_qty || 0)} />
          <StatCard label="Total Baris" value={angka(summary.total_items || 0)} />
          <StatCard label="Total Nilai Pembelian" value={rupiah(summary.total_value || 0)} />
        </>
      )}
    </div>
  );
}
