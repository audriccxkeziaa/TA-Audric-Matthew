"use client";
// Modal detail stok masuk 7 hari terakhir (klik kartu "Stok Masuk").
// Hanya menampilkan nota yang berstatus tervalidasi.

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { purchasesApi } from "@/lib/api";
import { rupiah, angka, tanggal } from "@/lib/format";
import { Modal, StatCard, Spinner, EmptyState, Badge } from "@/components/ui";
import { last7DaysRange } from "../lib/dateRange";
import { PurchaseDetailPopup } from "./detailPopups";

export function StockInModal({ open, onClose }) {
  const range = useMemo(() => last7DaysRange(), []);
  const [drillPurchaseId, setDrillPurchaseId] = useState(null);
  const q = useQuery({
    queryKey: ["purchases-7d", range.from],
    queryFn: () => purchasesApi.list({ from: range.from, to: range.to, limit: 100 }),
    enabled: open,
  });
  const rows = (q.data?.data || []).filter((p) => p.status_validasi === "tervalidasi");
  const total = rows.reduce((acc, r) => acc + Number(r.total || 0), 0);

  return (
    <Modal open={open} onClose={() => { setDrillPurchaseId(null); onClose(); }} title="Detail Stok Masuk (7 Hari Terakhir)" width="max-w-3xl">
      {drillPurchaseId ? (
        <PurchaseDetailPopup purchaseId={drillPurchaseId} onBack={() => setDrillPurchaseId(null)} />
      ) : q.isLoading ? (
        <Spinner label="Memuat..." />
      ) : (
        <>
          <div className="mb-3 grid grid-cols-2 gap-3">
            <StatCard label="Jumlah Nota Tervalidasi" value={angka(rows.length)} />
            <StatCard label="Total Nilai Pembelian" value={rupiah(total)} tone="good" />
          </div>
          {rows.length === 0 ? (
            <EmptyState
              title="Belum ada stok masuk"
              description="Belum ada nota supplier yang tervalidasi dalam 7 hari terakhir."
            />
          ) : (
            <div className="max-h-80 overflow-auto thin-scroll rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Tanggal</th>
                    <th className="px-3 py-2">No. Nota</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-xs">{tanggal(r.created_at)}</td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => setDrillPurchaseId(r.id)}
                          className="font-mono text-xs font-medium text-brand-600 hover:text-brand-800 hover:underline"
                        >
                          {r.no_nota_supplier || "—"}
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        <Badge tone="green">{r.status_validasi}</Badge>
                      </td>
                      <td className="px-3 py-2 text-right font-semibold">
                        {rupiah(r.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
