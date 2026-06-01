"use client";
// /dashboard/restock — Rekomendasi Restock (R5). Orkestrator UI.

import { PageShell, PageHeader, Card, Select, StatCard } from "@/components/ui";
import { angka } from "@/lib/format";
import { useRestock } from "../hooks/useRestock";
import { RestockTable } from "./RestockTable";

export default function RestockPage() {
  const r = useRestock();

  return (
    <PageShell>
      <PageHeader
        title="Rekomendasi Restock"
        description="Halaman untuk menampilkan daftar spareparts yang perlu restock."
      />

      <div className="mb-3 grid shrink-0 gap-3 sm:grid-cols-4">
        <StatCard label="Total Barang" value={angka(r.summary.total)} />
        <StatCard label="Habis" value={angka(r.summary.habis)} tone="bad" />
        <StatCard label="Kritis" value={angka(r.summary.kritis)} tone="warn" />
        <StatCard label="Menipis" value={angka(r.summary.menipis)} />
      </div>

      <Card className="mb-3 shrink-0 p-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-700">Filter Kondisi:</span>
          <Select
            value={r.stockFilter}
            onChange={(e) => {
              r.setStockFilter(e.target.value);
              r.setPage(1);
            }}
          >
            <option value="all">Semua Kondisi</option>
            <option value="HABIS">Stok Habis</option>
            <option value="KRITIS">Stok Kritis</option>
            <option value="MENIPIS">Stok Menipis</option>
          </Select>
        </div>
      </Card>

      <RestockTable
        rows={r.paginatedItems}
        isEmpty={r.items.length === 0}
        isLoading={r.isLoading}
        page={r.page}
        pageSize={r.pageSize}
      />

      {r.items.length > r.pageSize && (
        <div className="mt-2 flex shrink-0 items-center justify-between text-sm text-slate-500">
          <span>
            {r.items.length} items · page {r.page}/{r.totalPages}
          </span>
          <div className="flex gap-1">
            <button
              disabled={r.page <= 1}
              onClick={() => r.setPage((p) => p - 1)}
              className="rounded border border-slate-200 px-3 py-1 text-xs hover:bg-slate-50 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              disabled={r.page >= r.totalPages}
              onClick={() => r.setPage((p) => p + 1)}
              className="rounded border border-slate-200 px-3 py-1 text-xs hover:bg-slate-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </PageShell>
  );
}
