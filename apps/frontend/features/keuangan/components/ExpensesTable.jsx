"use client";
// Tabel pengeluaran terpadu: gabungan Pembelian Supplier + Pengeluaran Operasional.
// Dipanggil dari tab "Daftar Pengeluaran" di KeuanganPage.

import { useState, useEffect } from "react";
import { Badge, Spinner, EmptyState, Table, THead, TH, TBody, TR, TD, Button } from "@/components/ui";
import { rupiah, tanggal } from "@/lib/format";
import { Eye } from "lucide-react";
import { JENIS_LABELS, JENIS_BADGE_TONE } from "../lib/constants";

const PAGE_SIZE = 15;

export function UnifiedExpensesTable({ rows, isLoading, onExpenseEdit, onPurchaseDetail }) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [rows.length]);

  if (isLoading) {
    return <div className="p-6"><Spinner label="Memuat pengeluaran..." /></div>;
  }

  if (!rows.length) {
    return (
      <EmptyState
        title="Belum ada pengeluaran"
        description="Belum ada pembelian supplier atau pengeluaran operasional pada periode ini."
      />
    );
  }

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const paged = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleAction(r) {
    if (r._type === "purchase") return onPurchaseDetail(r._rawId);
    return onExpenseEdit(r._raw);
  }

  return (
    <div className="flex flex-col">
      <div className="overflow-auto thin-scroll">
        {/* Desktop */}
        <Table className="min-w-[600px]">
          <THead>
            <TH>Tanggal</TH>
            <TH>Jenis</TH>
            <TH>Deskripsi</TH>
            <TH>Dicatat Oleh</TH>
            <TH className="text-right">Nominal</TH>
            <TH className="text-right">Aksi</TH>
          </THead>
          <TBody>
            {paged.map((r) => (
              <TR key={r.id}>
                <TD className="text-xs">{tanggal(r.tanggal)}</TD>
                <TD>
                  <Badge tone={JENIS_BADGE_TONE[r.jenis] || "slate"}>
                    {JENIS_LABELS[r.jenis] || r.jenis}
                  </Badge>
                </TD>
                <TD>{r.deskripsi}</TD>
                <TD className="text-slate-500">{r.username}</TD>
                <TD className="text-right font-semibold text-red-600">
                  − {rupiah(r.nominal)}
                </TD>
                <TD className="text-right">
                  <button
                    onClick={() => handleAction(r)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-slate-100 transition"
                    title="Lihat detail"
                  >
                    <Eye size={15} className="text-slate-500" />
                  </button>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>

        {/* Mobile cards */}
        <ul className="divide-y divide-slate-100 md:hidden">
          {paged.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-2 p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Badge tone={JENIS_BADGE_TONE[r.jenis] || "slate"}>
                    {JENIS_LABELS[r.jenis] || r.jenis}
                  </Badge>
                  <span className="text-xs text-slate-400">{tanggal(r.tanggal)}</span>
                </div>
                <p className="mt-1 text-sm text-slate-700">{r.deskripsi}</p>
                <p className="text-xs text-slate-400">Oleh: {r.username}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="font-semibold text-red-600">− {rupiah(r.nominal)}</span>
                <button
                  onClick={() => handleAction(r)}
                  className="flex h-7 w-7 items-center justify-center rounded hover:bg-slate-100 transition"
                  title="Lihat detail"
                >
                  <Eye size={14} className="text-slate-500" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {rows.length > PAGE_SIZE && (
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
          <span>Page {page} dari {totalPages} ({rows.length} transaksi)</span>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              ← Prev
            </Button>
            <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next →
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
