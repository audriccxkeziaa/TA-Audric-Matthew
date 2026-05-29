"use client";
// Modal detail revenue hari ini (klik kartu "Revenue Hari Ini").

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { salesApi } from "@/lib/api";
import { rupiah, jam } from "@/lib/format";
import { Modal, StatCard, Spinner, EmptyState } from "@/components/ui";
import { todayRange } from "../lib/dateRange";
import { SaleDetailPopup } from "./detailPopups";

export function RevenueTodayModal({ open, onClose }) {
  const range = useMemo(() => todayRange(), []);
  const [drillSaleId, setDrillSaleId] = useState(null);
  const q = useQuery({
    queryKey: ["sales-today", range.from],
    queryFn: () => salesApi.list({ from: range.from, to: range.to, limit: 200 }),
    enabled: open,
  });
  const rows = q.data?.data || [];
  const total = rows.reduce((acc, r) => acc + Number(r.total_harga || 0), 0);
  const avg = rows.length ? total / rows.length : 0;
  const maxTrx = rows.length ? Math.max(...rows.map((r) => Number(r.total_harga || 0))) : 0;
  const minTrx = rows.length ? Math.min(...rows.map((r) => Number(r.total_harga || 0))) : 0;

  return (
    <Modal open={open} onClose={() => { setDrillSaleId(null); onClose(); }} title="Detail Revenue Hari Ini" width="max-w-3xl">
      {drillSaleId ? (
        <SaleDetailPopup saleId={drillSaleId} onBack={() => setDrillSaleId(null)} />
      ) : q.isLoading ? (
        <Spinner label="Memuat revenue..." />
      ) : (
        <>
          <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Total Revenue" value={rupiah(total)} tone="good" />
            <StatCard label="Rata-rata / Trx" value={rupiah(avg)} />
            <StatCard label="Trx Tertinggi" value={rupiah(maxTrx)} />
            <StatCard label="Trx Terendah" value={rupiah(minTrx)} />
          </div>
          {rows.length === 0 ? (
            <EmptyState title="Belum ada revenue hari ini" />
          ) : (
            <div className="max-h-80 overflow-auto thin-scroll rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Waktu</th>
                    <th className="px-3 py-2">Kode Transaksi</th>
                    <th className="px-3 py-2 text-right">Revenue</th>
                    <th className="px-3 py-2 text-right">% dari Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-mono text-xs">{jam(r.created_at)}</td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => setDrillSaleId(r.id)}
                          className="font-mono text-xs font-medium text-brand-600 hover:text-brand-800 hover:underline"
                        >
                          {r.kode_transaksi}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-emerald-700">{rupiah(r.total_harga)}</td>
                      <td className="px-3 py-2 text-right text-xs text-slate-500">
                        {total > 0 ? ((Number(r.total_harga) / total) * 100).toFixed(1) : 0}%
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
