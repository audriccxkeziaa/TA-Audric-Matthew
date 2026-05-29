"use client";
// Tabel audit log. Klik baris membuka modal detail forensik.

import { Card, Spinner, EmptyState } from "@/components/ui";
import { tanggalJam } from "@/lib/format";
import { ruleBadge, actionBadge, humanSource, humanReason } from "./auditHelpers";

export function AuditTable({ rows, isLoading, page, pageSize, onRowClick }) {
  return (
    <Card className="flex flex-col p-0 md:min-h-0 md:flex-1">
      {isLoading ? (
        <div className="p-6">
          <Spinner label="Memuat audit log..." />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState title="Tidak ada catatan audit untuk filter ini" />
      ) : (
        <div className="overflow-auto thin-scroll md:min-h-0 md:flex-1">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2.5 w-8">No</th>
                <th className="px-3 py-2.5">Waktu</th>
                <th className="px-3 py-2.5">User</th>
                <th className="px-3 py-2.5">Barang</th>
                <th className="px-3 py-2.5">Sumber</th>
                <th className="px-3 py-2.5">Rule</th>
                <th className="px-3 py-2.5">Aksi</th>
                <th className="px-3 py-2.5 text-right">Δ Qty</th>
                <th className="px-3 py-2.5">Alasan</th>
                <th className="px-3 py-2.5 text-center">Aksi</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, index) => (
                <tr
                  key={r.id}
                  onClick={() => onRowClick(r)}
                  className="cursor-pointer transition-colors hover:bg-brand-50/40"
                >
                  <td className="px-3 py-2 text-xs text-slate-400">
                    {(page - 1) * pageSize + index + 1}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs">
                    {tanggalJam(r.created_at)}
                  </td>
                  <td className="px-3 py-2">
                    {r.username || "—"}
                    {r.user_role && (
                      <span className="block text-xs text-slate-400">
                        {r.user_role}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {r.nama_barang || (
                      <span className="text-slate-300">(tanpa produk)</span>
                    )}
                    {r.kode_barang && (
                      <span className="block font-mono text-xs text-slate-400">
                        {r.kode_barang}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">{humanSource(r.source_type)}</td>
                  <td className="px-3 py-2">{ruleBadge(r.rule_triggered)}</td>
                  <td className="px-3 py-2">{actionBadge(r.rule_action)}</td>
                  <td className="px-3 py-2 text-right font-semibold">
                    {r.delta_qty > 0 ? `+${r.delta_qty}` : r.delta_qty}
                  </td>
                  <td className="px-3 py-2 max-w-xs">
                    <span className="line-clamp-2 text-xs text-slate-600">
                      {humanReason(r)}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => onRowClick(r)}
                      className="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-slate-100 transition"
                      title="Lihat detail"
                    >
                      <svg className="w-4 h-4 text-slate-600 hover:text-brand-600" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 5C7 5 2.73 8.11 1 12.46c1.73 4.35 6 7.54 11 7.54s9.27-3.19 11-7.54C21.27 8.11 17 5 12 5zm0 12.5c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
