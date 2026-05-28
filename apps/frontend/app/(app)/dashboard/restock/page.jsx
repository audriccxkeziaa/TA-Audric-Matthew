"use client";
// /dashboard/restock — R5 Rekomendasi Restock (admin)
// Menampilkan barang aktif dengan stok <= min_stock dari view
// v_restock_recommendation. Admin dapat menyesuaikan min_stock
// langsung dari halaman ini (PATCH /api/products/:id).
// min_stock ditetapkan MANUAL — bukan Min-Max/EOQ/AI.

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
function RestockRow({ item, isAdmin, index }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(item.min_stock);
  const [alasan, setAlasan] = useState("");

  const save = useMutation({
    mutationFn: () =>
      productsApi.update(item.id, {
        min_stock: parseInt(value, 10) || 0,
        alasan,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["restock"] });
      qc.invalidateQueries({ queryKey: ["notif-low-stock"] });
      toast.success(`Min. stok "${item.nama_barang}" diperbarui`);
      setEditing(false);
      setAlasan("");
    },
    onError: (e) => toast.error(e.message),
  });

  function handleCancel() {
    setValue(item.min_stock);
    setAlasan("");
    setEditing(false);
  }

  return (
    <tr className="hover:bg-slate-50">
      <td className="px-4 py-2.5 text-xs text-slate-400">{index}</td>
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
        {angka(item.kekurangan)} unit
      </td>
      <td className="px-4 py-2.5 text-right">
        {Number(item.avg_sales_30d || 0) === 0 ? (
          <span className="text-slate-400 text-xs">Belum ada data</span>
        ) : (
          <span>{Number(item.avg_sales_30d).toFixed(2)}<span className="text-slate-400 text-xs"> unit/hr</span></span>
        )}
      </td>
      <td className="px-4 py-2.5 text-right">
        {item.estimasi_hari_habis == null ? (
          <span className="text-slate-400 text-xs">Belum terjual 30h</span>
        ) : Number(item.estimasi_hari_habis) <= 7 ? (
          <span className="font-semibold text-red-600">{item.estimasi_hari_habis} hari</span>
        ) : Number(item.estimasi_hari_habis) <= 14 ? (
          <span className="font-semibold text-amber-600">{item.estimasi_hari_habis} hari</span>
        ) : (
          <span className="text-slate-700">{item.estimasi_hari_habis} hari</span>
        )}
      </td>
      <td className="px-4 py-2.5">{urgensiBadge(item.tingkat_urgensi)}</td>
      {isAdmin && (
        <td className="px-4 py-2.5">
          {editing ? (
            <div className="flex flex-col items-end gap-1.5 min-w-[200px]">
              <input
                type="text"
                placeholder="Alasan perubahan (wajib)"
                value={alasan}
                onChange={(e) => setAlasan(e.target.value)}
                className="w-full rounded border border-slate-300 px-2 py-1 text-sm placeholder:text-slate-400"
              />
              <div className="flex gap-1">
                <Button
                  size="sm"
                  onClick={() => save.mutate()}
                  disabled={save.isPending || !alasan.trim()}
                >
                  Simpan
                </Button>
                <Button size="sm" variant="ghost" onClick={handleCancel}>
                  Batal
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex justify-end">
              <button
                onClick={() => setEditing(true)}
                className="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-slate-100 transition"
                title="Ubah min. stok"
              >
                <svg className="w-4 h-4 text-slate-600 hover:text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
            </div>
          )}
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
                  <th className="px-4 py-2.5 w-8">No</th>
                  <th className="px-4 py-2.5">Kode Barang</th>
                  <th className="px-4 py-2.5">Nama Barang</th>
                  <th className="px-4 py-2.5 text-right">Stok</th>
                  <th className="px-4 py-2.5 text-right" title="Batas minimum stok yang ditetapkan admin. Jika stok ≤ nilai ini, barang masuk radar restock.">Min Stok ⓘ</th>
                  <th className="px-4 py-2.5 text-right" title="Jumlah unit minimum yang perlu dibeli agar stok kembali ke batas minimum (= Min Stok − Stok Sekarang).">Perlu Beli ⓘ</th>
                  <th className="px-4 py-2.5 text-right" title="Rata-rata unit terjual per hari, dihitung dari total penjualan 30 hari terakhir dibagi 30.">Laju Jual/Hari ⓘ</th>
                  <th className="px-4 py-2.5 text-right" title="Prediksi berapa hari lagi stok akan habis jika laju jual tetap sama (= Stok ÷ Laju Jual/Hari). Merah &lt;7 hari, kuning &lt;14 hari.">Estimasi Habis ⓘ</th>
                  <th className="px-4 py-2.5">Status</th>
                  {isAdmin && <th className="px-4 py-2.5 text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedItems.map((it, index) => (
                  <RestockRow 
                  key={it.id} 
                  item={it} 
                  isAdmin={isAdmin}
                  index={(page - 1) * PAGE_SIZE + index + 1}
                />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {items.length > PAGE_SIZE && (
        <div className="mt-2 flex shrink-0 items-center justify-between text-sm text-slate-500">
          <span>
            {items.length} items · page {page}/{totalPages}
          </span>
          <div className="flex gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded border border-slate-200 px-3 py-1 text-xs hover:bg-slate-50 disabled:opacity-40"
            >
              ← Previous
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded border border-slate-200 px-3 py-1 text-xs hover:bg-slate-50 disabled:opacity-40"
            >
              Next →
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
          {!isAdmin && " (Hanya admin yang dapat mengubah min. stok.)"}
        </p>
      </div>
    </PageShell>
  );
}
