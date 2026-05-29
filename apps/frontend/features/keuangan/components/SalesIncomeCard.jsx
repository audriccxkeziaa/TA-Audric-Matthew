"use client";
// Kartu "Pendapatan Kotor" + modal detail penjualan (paginasi 10/hal).

import { Card, Button, Modal, Spinner } from "@/components/ui";
import { rupiah, tanggal } from "@/lib/format";

export function SalesIncomeCard({
  omsetKotor,
  salesRows,
  salesLoading,
  showSales,
  onOpen,
  onClose,
  salesPage,
  setSalesPage,
  onTrxDetail,
}) {
  return (
    <Card className="mb-3 shrink-0 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Pendapatan Kotor
        </p>
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex items-center gap-1 rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition"
          title="Lihat detail pemasukan"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>
      <p className="mt-1 text-lg font-bold text-emerald-700">
        + {rupiah(omsetKotor || salesRows.reduce((a, r) => a + Number(r.total_harga || 0), 0))}
      </p>

      {/* --- POP UP MODAL PEMASUKAN --- */}
      <Modal
        open={showSales}
        onClose={onClose}
        title="Detail Pendapatan Kotor dari Penjualan"
        width="max-w-4xl"
      >
        {salesLoading ? (
          <Spinner label="Memuat..." />
        ) : salesRows.length === 0 ? (
          <p className="text-sm text-slate-400">Belum ada transaksi penjualan pada periode ini.</p>
        ) : (() => {
          // Logika pemecah halaman (Pagination)
          const PAGE_SIZE = 10;
          const totalPages = Math.max(1, Math.ceil(salesRows.length / PAGE_SIZE));
          const paginatedSales = salesRows.slice((salesPage - 1) * PAGE_SIZE, salesPage * PAGE_SIZE);

          return (
            <>
              <div className="max-h-96 overflow-auto thin-scroll rounded-lg border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Tanggal</th>
                      <th className="px-3 py-2">Kode Transaksi</th>
                      <th className="px-3 py-2">Kasir</th>
                      <th className="px-3 py-2 text-right">Nominal</th>
                      <th className="px-3 py-2 text-center">Detail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedSales.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-xs">{tanggal(r.created_at)}</td>
                        <td className="px-3 py-2 font-mono text-xs">{r.kode_transaksi}</td>
                        <td className="px-3 py-2 text-xs text-slate-500">{r.kasir || r.users?.username || "-"}</td>
                        <td className="px-3 py-2 text-right font-semibold text-emerald-600">
                          + {rupiah(r.total_harga)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => onTrxDetail(r.id)}
                            className="inline-flex items-center justify-center rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Tombol Navigasi Pagination */}
              {salesRows.length > PAGE_SIZE && (
                <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
                  <span>page {salesPage} of {totalPages} ({salesRows.length} transactions)</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" disabled={salesPage <= 1} onClick={() => setSalesPage((p) => p - 1)}>
                      ← Previous
                    </Button>
                    <Button size="sm" variant="secondary" disabled={salesPage >= totalPages} onClick={() => setSalesPage((p) => p + 1)}>
                      Next →
                    </Button>
                  </div>
                </div>
              )}
            </>
          );
        })()}
      </Modal>
    </Card>
  );
}
