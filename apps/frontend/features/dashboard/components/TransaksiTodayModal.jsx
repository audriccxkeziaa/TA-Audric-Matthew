"use client";
// Modal detail transaksi hari ini (klik kartu "Transaksi Hari Ini").

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { salesApi } from "@/lib/api";
import { rupiah, angka, jam } from "@/lib/format";
import { Modal, StatCard, Spinner, EmptyState } from "@/components/ui";
import { todayRange } from "../lib/dateRange";
import { SaleDetailPopup } from "./detailPopups";

export function TransaksiTodayModal({ open, onClose }) {
  const range = useMemo(() => todayRange(), []);
  const [drillSaleId, setDrillSaleId] = useState(null);
  const q = useQuery({
    queryKey: ["sales-today", range.from],
    queryFn: () => salesApi.list({ from: range.from, to: range.to, limit: 200 }),
    enabled: open,
  });
  const rows = q.data?.data || [];
  const kasirMap = {};
  for (const r of rows) {
    const k = r.kasir || r.users?.username || "Unknown";
    kasirMap[k] = (kasirMap[k] || 0) + 1;
  }

  return (
    <Modal open={open} onClose={() => { setDrillSaleId(null); onClose(); }} title="Detail Transaksi Hari Ini" width="max-w-3xl">
      {drillSaleId ? (
        <SaleDetailPopup saleId={drillSaleId} onBack={() => setDrillSaleId(null)} />
      ) : q.isLoading ? (
        <Spinner label="Memuat transaksi..." />
      ) : (
        <>
          <div className="mb-3 grid grid-cols-2 gap-3">
            <StatCard label="Jumlah Transaksi" value={angka(rows.length)} />
            <StatCard label="Kasir Aktif" value={angka(Object.keys(kasirMap).length)} />
          </div>
          {Object.keys(kasirMap).length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {Object.entries(kasirMap).map(([k, count]) => (
                <span key={k} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs">
                  <span className="font-medium">{k}</span>
                  <span className="text-slate-400">{count} trx</span>
                </span>
              ))}
            </div>
          )}
          {rows.length === 0 ? (
            <EmptyState title="Belum ada transaksi hari ini" />
          ) : (
            <div className="max-h-80 overflow-auto thin-scroll rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Waktu</th>
                    <th className="px-3 py-2">Kode Transaksi</th>
                    <th className="px-3 py-2">Kasir</th>
                    <th className="px-3 py-2 text-center">Item</th>
                    <th className="px-3 py-2 text-right">Total</th>
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
                      <td className="px-3 py-2 text-xs text-slate-600">{r.kasir || r.users?.username || "-"}</td>
                      <td className="px-3 py-2 text-center text-xs">{r.item_count || "-"}</td>
                      <td className="px-3 py-2 text-right font-semibold">{rupiah(r.total_harga)}</td>
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
