"use client";
// Tabel rincian pemasukan dari penjualan kasir (tab Rincian Pemasukan).

import { useState, useEffect } from "react";
import { Spinner, EmptyState, Table, THead, TH, TBody, TR, TD, Button } from "@/components/ui";
import { rupiah, tanggal } from "@/lib/format";
import { Eye } from "lucide-react";

const PAGE_SIZE = 10;

export function SalesTable({ rows, isLoading, onDetail }) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [rows.length]);

  if (isLoading) {
    return <div className="p-6"><Spinner label="Memuat penjualan..." /></div>;
  }

  if (!rows.length) {
    return (
      <EmptyState
        title="Belum ada transaksi penjualan"
        description="Tidak ada penjualan pada periode yang dipilih."
      />
    );
  }

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const paged = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="flex flex-col">
      <div className="overflow-auto thin-scroll">
        {/* Desktop */}
        <Table className="min-w-[500px]">
          <THead>
            <TH>Tanggal</TH>
            <TH>Kode Transaksi</TH>
            <TH>Kasir</TH>
            <TH className="text-right">Nominal</TH>
            <TH className="text-right">Aksi</TH>
          </THead>
          <TBody>
            {paged.map((r) => (
              <TR key={r.id}>
                <TD className="text-xs">{tanggal(r.created_at)}</TD>
                <TD className="font-mono text-xs">{r.kode_transaksi}</TD>
                <TD className="text-slate-500">{r.kasir || r.users?.username || "-"}</TD>
                <TD className="text-right font-semibold text-emerald-600">
                  + {rupiah(r.total_harga)}
                </TD>
                <TD className="text-right">
                  <button
                    type="button"
                    onClick={() => onDetail(r.id)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-slate-100 transition"
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
                <p className="font-mono text-xs text-slate-700">{r.kode_transaksi}</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {tanggal(r.created_at)} · {r.kasir || r.users?.username || "-"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="font-semibold text-emerald-600">+ {rupiah(r.total_harga)}</span>
                <button
                  type="button"
                  onClick={() => onDetail(r.id)}
                  className="flex h-7 w-7 items-center justify-center rounded hover:bg-slate-100 transition"
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
          <span>Halaman {page} dari {totalPages} ({rows.length} transaksi)</span>
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
