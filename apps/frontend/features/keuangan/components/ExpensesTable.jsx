"use client";
// Tabel pengeluaran operasional. Tombol mata membuka form edit.

import { Card, Badge, Spinner, EmptyState } from "@/components/ui";
import { rupiah, tanggal } from "@/lib/format";
import { JENIS_OPTIONS, JENIS_TONE } from "../lib/constants";

export function ExpensesTable({ rows, isLoading, onEdit }) {
  return (
    <Card className="flex flex-col p-0 md:min-h-0 md:flex-1">
      {isLoading ? (
        <div className="p-6">
          <Spinner label="Memuat pengeluaran..." />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="Belum ada pengeluaran operasional"
          description="Klik 'Tambah Pengeluaran Operasional' untuk mencatat gaji/listrik/dll."
        />
      ) : (
        <div className="overflow-auto thin-scroll md:min-h-0 md:flex-1">
          <table className="w-full min-w-[500px] text-sm">
            <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Tanggal</th>
                <th className="px-4 py-2.5">Jenis</th>
                <th className="px-4 py-2.5">Deskripsi</th>
                <th className="px-4 py-2.5">Dicatat oleh</th>
                <th className="px-4 py-2.5 text-right">Nominal</th>
                <th className="px-4 py-2.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 text-xs">{tanggal(r.tanggal)}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={JENIS_TONE[r.jenis] || "slate"}>
                      {JENIS_OPTIONS.find((o) => o.value === r.jenis)?.label || r.jenis}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5">{r.deskripsi}</td>
                  <td className="px-4 py-2.5 text-slate-500">{r.username || "-"}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-red-600">
                    − {rupiah(r.nominal)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => onEdit(r)}
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
