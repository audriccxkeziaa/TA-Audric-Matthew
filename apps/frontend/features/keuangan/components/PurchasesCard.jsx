"use client";
// Kartu "Pembelian Supplier" + modal detail nota (paginasi 5/hal).

import { Card, Button, Modal, Spinner } from "@/components/ui";
import { rupiah, tanggal } from "@/lib/format";

export function PurchasesCard({
  totalPembelian,
  purchasesRows,
  purchasesLoading,
  showPurchases,
  onOpen,
  onClose,
  purchasesPage,
  setPurchasesPage,
  onPurchaseDetail,
}) {
  return (
    <Card className="mb-3 shrink-0 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Pembelian Supplier
        </p>
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex items-center gap-1 rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition"
          title="Lihat detail nota supplier"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>
      <p className="mt-1 text-lg font-bold text-amber-700">
        − {rupiah(totalPembelian || 0)}
      </p>

      {/* --- POP UP MODAL PEMBELIAN --- */}
      <Modal
        open={showPurchases}
        onClose={onClose}
        title="Detail Pembelian Supplier"
        width="max-w-4xl"
      >
        {purchasesLoading ? (
          <Spinner label="Memuat..." />
        ) : purchasesRows.length === 0 ? (
          <p className="text-sm text-slate-400">Belum ada pembelian supplier pada periode ini.</p>
        ) : (() => {
          // Logika pemecah halaman (Pagination)
          const PAGE_SIZE = 5;
          const totalPages = Math.max(1, Math.ceil(purchasesRows.length / PAGE_SIZE));
          const paginatedPurch = purchasesRows.slice((purchasesPage - 1) * PAGE_SIZE, purchasesPage * PAGE_SIZE);

          return (
            <>
              <div className="max-h-96 overflow-auto thin-scroll rounded-lg border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Tanggal</th>
                      <th className="px-3 py-2">No. Nota</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2 text-right">Total</th>
                      <th className="px-3 py-2 text-center">Detail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedPurch.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-xs">{tanggal(r.created_at)}</td>
                        <td className="px-3 py-2 font-mono text-xs">{r.no_nota_supplier || "-"}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            r.status_validasi === "tervalidasi"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          }`}>
                            {r.status_validasi === "tervalidasi" ? "Tervalidasi" : "Draft"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-amber-700">
                          − {rupiah(r.total || 0)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => onPurchaseDetail(r.id)}
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
              {purchasesRows.length > PAGE_SIZE && (
                <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
                  <span>page {purchasesPage} of {totalPages} ({purchasesRows.length} supplier invoices)</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" disabled={purchasesPage <= 1} onClick={() => setPurchasesPage((p) => p - 1)}>
                      ← Previous
                    </Button>
                    <Button size="sm" variant="secondary" disabled={purchasesPage >= totalPages} onClick={() => setPurchasesPage((p) => p + 1)}>
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
