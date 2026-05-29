"use client";
// Modal detail pengeluaran per jenis (dipicu klik kotak breakdown).

import { Modal, EmptyState } from "@/components/ui";
import { rupiah, tanggal } from "@/lib/format";
import { JENIS_OPTIONS } from "../lib/constants";

export function JenisDetailModal({ open, onClose, jenis, rows }) {
  const opt = JENIS_OPTIONS.find((o) => o.value === jenis);
  const filtered = rows.filter((r) => r.jenis === jenis);
  const total = filtered.reduce((a, r) => a + Number(r.nominal || 0), 0);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Detail — ${opt?.label || jenis}`}
      width="max-w-2xl"
    >
      <div className="mb-3 rounded-lg bg-slate-50 p-3 text-center">
        <p className="text-xs uppercase tracking-wide text-slate-500">
          Total {opt?.label || jenis}
        </p>
        <p className="mt-1 text-2xl font-extrabold text-slate-900">
          {rupiah(total)}
        </p>
        <p className="text-xs text-slate-400">
          {filtered.length} entri pada filter saat ini
        </p>
      </div>
      {filtered.length === 0 ? (
        <EmptyState
          title={`Belum ada pengeluaran ${opt?.label || jenis}`}
          description="Tambahkan lewat tombol 'Tambah Pengeluaran Operasional'."
        />
      ) : (
        <div className="max-h-80 overflow-auto thin-scroll rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Tanggal</th>
                <th className="px-3 py-2">
                  {jenis === "supplier" ? "Nama Supplier" : "Deskripsi"}
                </th>
                <th className="px-3 py-2">Dicatat oleh</th>
                <th className="px-3 py-2 text-right">Nominal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-xs">{tanggal(r.tanggal)}</td>
                  <td className="px-3 py-2">{r.deskripsi}</td>
                  <td className="px-3 py-2 text-slate-500">{r.username || "-"}</td>
                  <td className="px-3 py-2 text-right font-semibold text-red-600">
                    − {rupiah(r.nominal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
