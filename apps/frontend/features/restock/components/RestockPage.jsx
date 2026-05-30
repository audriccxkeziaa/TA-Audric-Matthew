"use client";
// /dashboard/restock — Rekomendasi Restock (R5). Orkestrator UI.

import { PageShell, PageHeader, Card, Select, StatCard } from "@/components/ui";
import { angka } from "@/lib/format";
import { useRestock } from "../hooks/useRestock";
import { RestockTable } from "./RestockTable";
import { RestockDetailModal } from "./RestockDetailModal";

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
        isAdmin={r.isAdmin}
        page={r.page}
        pageSize={r.pageSize}
        onDetail={r.setDetailItem}
        onEdit={r.setEditItem}
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

      <div className="mt-2 shrink-0 space-y-0.5 text-xs text-slate-400">
        <p>
          <span className="font-medium text-slate-500">Perlu Beli</span> = Min Stok − Stok Sekarang (jumlah minimum yang harus dipesan).
        </p>
        <p>
          <span className="font-medium text-slate-500">Laju Jual/Hari</span> = total terjual 30 hari terakhir ÷ 30. &quot;Belum ada data&quot; = belum ada penjualan bulan ini.
        </p>
        <p>
          <span className="font-medium text-slate-500">Estimasi Habis</span> = Stok ÷ Laju Jual/Hari. Prediksi kapan stok menyentuh 0 jika pola jual tidak berubah.{" "}
          <span className="text-red-500 font-medium">Merah</span> = &lt;7 hari, <span className="text-amber-500 font-medium">kuning</span> = &lt;14 hari.
        </p>
        <p>
          <span className="font-medium text-slate-500">Min Stok</span> = batas alarm restock, idealnya = laju jual × estimasi hari tiba kiriman supplier.
          {!r.isAdmin && " (Hanya admin yang dapat mengubah min. stok.)"}
        </p>
        <p>
          <span className="font-medium text-slate-500">ROP (Reorder Point)</span> = batas stok yang jika dilewati, barang harus dipesan segera agar tidak lost sales.
          Dihitung otomatis: <span className="font-mono text-slate-600">(laju jual × 3 hari lead time) + (laju jual × 2 hari safety stock)</span>.{" "}
          <span className="text-red-500 font-medium">Pesan Sekarang!</span> = stok sudah di bawah ROP.
        </p>
      </div>

      {r.isAdmin && (
        <RestockDetailModal item={r.detailItem} onClose={() => r.setDetailItem(null)} viewOnly />
      )}
      {r.isAdmin && (
        <RestockDetailModal item={r.editItem} onClose={() => r.setEditItem(null)} />
      )}
    </PageShell>
  );
}
