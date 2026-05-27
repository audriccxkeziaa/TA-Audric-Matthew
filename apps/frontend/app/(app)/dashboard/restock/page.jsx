"use client";
// =================================================================
// /dashboard/restock — R5 Rekomendasi Restock (admin)
// =================================================================
// Menampilkan barang aktif dengan stok <= min_stock dari view
// v_restock_recommendation. Admin dapat menyesuaikan min_stock
// langsung dari halaman ini (PATCH /api/products/:id).
// min_stock ditetapkan MANUAL — bukan Min-Max/EOQ/AI.
// =================================================================

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { restockApi, productsApi } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { angka } from "@/lib/format";
import {
  PageShell,
  PageHeader,
  Card,
  Button,
  Badge,
  Spinner,
  EmptyState,
  StatCard,
} from "@/components/ui";

const PAGE_SIZE = 20;

function urgensiBadge(level) {
  if (level === "HABIS") return <Badge tone="red">HABIS</Badge>;
  if (level === "KRITIS") return <Badge tone="amber">KRITIS</Badge>;
  return <Badge tone="blue">MENIPIS</Badge>;
}

// Baris dengan editor min_stock inline.
function RestockRow({ item, isAdmin }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(item.min_stock);

  const save = useMutation({
    mutationFn: () =>
      productsApi.update(item.id, {
        min_stock: parseInt(value, 10) || 0,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["restock"] });
      qc.invalidateQueries({ queryKey: ["notif-low-stock"] });
      toast.success(`Min. stok "${item.nama_barang}" diperbarui`);
      setEditing(false);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <tr className="hover:bg-slate-50">
      <td className="px-4 py-2.5 font-mono text-xs">{item.kode_barang}</td>
      <td className="px-4 py-2.5">
        {item.nama_barang}
        <span className="block text-xs text-slate-400">
          {item.merk || "-"}
        </span>
      </td>
      <td className="px-4 py-2.5 text-right font-semibold">
        {angka(item.stok)}
      </td>
      <td className="px-4 py-2.5 text-right">
        {editing ? (
          <input
            type="number"
            min="0"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-20 rounded border border-slate-300 px-2 py-1 text-right text-sm"
          />
        ) : (
          angka(item.min_stock)
        )}
      </td>
      <td className="px-4 py-2.5 text-right font-semibold text-red-600">
        {angka(item.kekurangan)}
      </td>
      <td className="px-4 py-2.5 text-right">
        {Number(item.avg_sales_30d || 0).toFixed(2)}
      </td>
      <td className="px-4 py-2.5 text-right">
        {item.estimasi_hari_habis != null
          ? `${item.estimasi_hari_habis} hari`
          : "—"}
      </td>
      <td className="px-4 py-2.5">{urgensiBadge(item.tingkat_urgensi)}</td>
      {isAdmin && (
        <td className="px-4 py-2.5">
          <div className="flex justify-end gap-1">
            {editing ? (
              <>
                <Button
                  size="sm"
                  onClick={() => save.mutate()}
                  disabled={save.isPending}
                >
                  Simpan
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setValue(item.min_stock);
                    setEditing(false);
                  }}
                >
                  Batal
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditing(true)}
              >
                Ubah Min
              </Button>
            )}
          </div>
        </td>
      )}
    </tr>
  );
}

export default function RestockPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["restock"],
    queryFn: restockApi.list,
  });
  const items = data?.data || [];
  const summary = data?.summary || { total: 0, habis: 0, kritis: 0, menipis: 0 };

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const paginatedItems = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <PageShell>
      <PageHeader
        title="Rekomendasi Restock"
        description="Halaman untuk menampilkan daftar spareparts yang perlu restock."
      />

      <div className="mb-3 grid shrink-0 gap-3 sm:grid-cols-4">
        <StatCard label="Total Barang" value={angka(summary.total)} />
        <StatCard label="Habis" value={angka(summary.habis)} tone="bad" />
        <StatCard label="Kritis" value={angka(summary.kritis)} tone="warn" />
        <StatCard label="Menipis" value={angka(summary.menipis)} />
      </div>

      <Card className="flex min-h-0 flex-1 flex-col p-0">
        {isLoading ? (
          <div className="p-6">
            <Spinner label="Memuat rekomendasi..." />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title="Tidak ada barang yang perlu restock"
            description="Semua stok di atas ambang minimum."
          />
        ) : (
          <div className="min-h-0 flex-1 overflow-auto thin-scroll">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Kode</th>
                  <th className="px-4 py-2.5">Nama Barang</th>
                  <th className="px-4 py-2.5 text-right">Stok</th>
                  <th className="px-4 py-2.5 text-right">Min</th>
                  <th className="px-4 py-2.5 text-right">Kekurangan</th>
                  <th className="px-4 py-2.5 text-right">Rata2/hari (30h)</th>
                  <th className="px-4 py-2.5 text-right">Estimasi Habis</th>
                  <th className="px-4 py-2.5">Urgensi</th>
                  {isAdmin && <th className="px-4 py-2.5 text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedItems.map((it) => (
                  <RestockRow key={it.id} item={it} isAdmin={isAdmin} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {items.length > PAGE_SIZE && (
        <div className="mt-2 flex shrink-0 items-center justify-between text-sm text-slate-500">
          <span>
            {items.length} barang · halaman {page}/{totalPages}
          </span>
          <div className="flex gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded border border-slate-200 px-3 py-1 text-xs hover:bg-slate-50 disabled:opacity-40"
            >
              ← Sebelumnya
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded border border-slate-200 px-3 py-1 text-xs hover:bg-slate-50 disabled:opacity-40"
            >
              Berikutnya →
            </button>
          </div>
        </div>
      )}

      <p className="mt-2 shrink-0 text-xs text-slate-400">
        Kolom &quot;Rata2/hari&quot; &amp; &quot;Estimasi Habis&quot; dihitung
        dari penjualan 30 hari terakhir sebagai bahan pertimbangan.
        {!isAdmin && " Min. stok hanya bisa diubah oleh admin."}
      </p>
    </PageShell>
  );
}
