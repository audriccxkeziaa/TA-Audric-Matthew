"use client";
// Tabel pengeluaran operasional. Tombol mata membuka form edit.

import { Card, Badge, Spinner, EmptyState, Table, THead, TH, TBody, TR, TD } from "@/components/ui";
import { rupiah, tanggal } from "@/lib/format";
import { JENIS_LABELS, JENIS_TONE } from "../lib/constants";

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
          {/* ===== Tampilan DESKTOP (md+) ===== */}
          <Table className="min-w-[500px]">
            <THead>
              <TH>Tanggal</TH>
              <TH>Jenis</TH>
              <TH>Deskripsi</TH>
              <TH>Dicatat oleh</TH>
              <TH className="text-right">Nominal</TH>
              <TH className="text-right">Aksi</TH>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.id}>
                  <TD className="text-xs">{tanggal(r.tanggal)}</TD>
                  <TD>
                    <Badge tone={JENIS_TONE[r.jenis] || "slate"}>
                      {JENIS_LABELS[r.jenis] || r.jenis}
                    </Badge>
                  </TD>
                  <TD>{r.deskripsi}</TD>
                  <TD className="text-slate-500">{r.username || "-"}</TD>
                  <TD className="text-right font-semibold text-red-600">
                    − {rupiah(r.nominal)}
                  </TD>
                  <TD className="text-right">
                    <button
                      onClick={() => onEdit(r)}
                      className="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-slate-100 transition"
                      title="Lihat detail"
                    >
                      <svg className="w-4 h-4 text-slate-600 hover:text-brand-600" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 5C7 5 2.73 8.11 1 12.46c1.73 4.35 6 7.54 11 7.54s9.27-3.19 11-7.54C21.27 8.11 17 5 12 5zm0 12.5c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                      </svg>
                    </button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>

          {/* ===== Tampilan HP (< md) — kartu per pengeluaran ===== */}
          <ul className="divide-y divide-slate-100 md:hidden">
            {rows.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-2 p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge tone={JENIS_TONE[r.jenis] || "slate"}>
                      {JENIS_LABELS[r.jenis] || r.jenis}
                    </Badge>
                    <span className="text-xs text-slate-400">{tanggal(r.tanggal)}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-700">{r.deskripsi}</p>
                  <p className="text-xs text-slate-400">Oleh: {r.username || "-"}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="font-semibold text-red-600">− {rupiah(r.nominal)}</span>
                  <button
                    onClick={() => onEdit(r)}
                    className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100 transition"
                    title="Lihat detail"
                    aria-label="Lihat detail"
                  >
                    <svg className="h-4 w-4 text-slate-600 hover:text-brand-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 5C7 5 2.73 8.11 1 12.46c1.73 4.35 6 7.54 11 7.54s9.27-3.19 11-7.54C21.27 8.11 17 5 12 5zm0 12.5c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                    </svg>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
