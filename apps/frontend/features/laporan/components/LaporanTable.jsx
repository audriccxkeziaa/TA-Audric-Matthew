"use client";
// Tabel laporan grouped per transaksi/nota. Klik baris atau ikon mata → modal detail.

import { Card, Spinner, EmptyState } from "@/components/ui";
import { rupiah, angka, tanggalJam } from "@/lib/format";

export function LaporanTable({
  isSales,
  isKasir = false,
  isLoading,
  isEmpty,
  rows,
  page,
  pageSize,
  onRowClick,
}) {
  return (
    <Card className="flex flex-col p-0 md:min-h-0 md:flex-1">
      {isLoading ? (
        <div className="p-6">
          <Spinner label="Memuat laporan..." />
        </div>
      ) : isEmpty ? (
        <EmptyState title="Tidak ada data pada periode ini" />
      ) : (
        <div className="overflow-auto thin-scroll md:min-h-0 md:flex-1">
          {/* ===== Tampilan DESKTOP (md+) ===== */}
          <table className="hidden w-full min-w-[600px] text-sm md:table">
            <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs uppercase text-slate-500">
              {isSales ? (
                <tr>
                  <th className="px-3 py-2.5 w-8">No</th>
                  <th className="px-3 py-2.5">Tanggal</th>
                  <th className="px-3 py-2.5">Kode Transaksi</th>
                  <th className="px-3 py-2.5">Kasir</th>
                  <th className="px-3 py-2.5 text-center">Jml Item</th>
                  <th className="px-3 py-2.5 text-right">Total Qty</th>
                  <th className="px-3 py-2.5 text-right">Total</th>
                  <th className="px-3 py-2.5 text-center no-print">Aksi</th>
                </tr>
              ) : (
                <tr>
                  <th className="px-3 py-2.5 w-8">No</th>
                  <th className="px-3 py-2.5">Tanggal</th>
                  <th className="px-3 py-2.5">No. Nota</th>
                  <th className="px-3 py-2.5">Input Oleh</th>
                  <th className="px-3 py-2.5 text-center">Jml Item</th>
                  <th className="px-3 py-2.5 text-right">Total Qty</th>
                  <th className="px-3 py-2.5 text-right">Total Nilai</th>
                  <th className="px-3 py-2.5 text-center no-print">Aksi</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((g, i) => (
                <tr
                  key={isSales ? g.sale_id : g.purchase_id}
                  onClick={() => onRowClick(g)}
                  className="cursor-pointer transition-colors hover:bg-brand-50"
                >
                  <td className="px-3 py-2.5 text-xs text-slate-400">
                    {(page - 1) * pageSize + i + 1}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-xs">
                    {tanggalJam(g.created_at)}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="font-mono text-xs font-medium text-brand-700">
                      {isSales ? g.kode_transaksi : g.no_nota || "-"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">
                    {isSales ? g.kasir : g.user}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                      {g.item_count} item
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {angka(g.total_qty)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-medium tabular-nums">
                    {rupiah(g.total)}
                  </td>
                  <td className="px-3 py-2.5 text-center no-print">
                    <button
                      onClick={(e) => { e.stopPropagation(); onRowClick(g); }}
                      className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-brand-50 transition"
                      title="Lihat detail"
                    >
                      <svg className="w-4 h-4 text-slate-500 hover:text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ===== Tampilan HP (< md) — kartu per transaksi/nota ===== */}
          <ul className="divide-y divide-slate-100 md:hidden">
            {rows.map((g, i) => (
              <li
                key={isSales ? g.sale_id : g.purchase_id}
                onClick={() => onRowClick(g)}
                className="cursor-pointer p-3 transition-colors hover:bg-brand-50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-medium text-brand-700">
                      {isSales ? g.kode_transaksi : g.no_nota || "-"}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {tanggalJam(g.created_at)} · {isSales ? g.kasir : g.user}
                    </p>
                  </div>
                  <span className="shrink-0 text-right font-semibold tabular-nums text-slate-900">
                    {rupiah(g.total)}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-500">
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                    {g.item_count} item
                  </span>
                  <span>Total Qty: {angka(g.total_qty)}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
