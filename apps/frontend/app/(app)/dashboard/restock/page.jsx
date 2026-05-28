"use client";

import { useState, useMemo } from "react";
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
  Select,
  Badge,
  Modal,
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

export default function RestockPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [page, setPage] = useState(1);
  const [detailItem, setDetailItem] = useState(null);
  const [stockFilter, setStockFilter] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["restock"],
    queryFn: restockApi.list,
    staleTime: 30_000,
  });
  const allItems = data?.data || [];
  const summary = data?.summary || { total: 0, habis: 0, kritis: 0, menipis: 0 };

  const items = useMemo(() => {
    if (stockFilter === "all") return allItems;
    return allItems.filter((it) => it.tingkat_urgensi === stockFilter);
  }, [allItems, stockFilter]);

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

      <Card className="mb-3 shrink-0 p-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-700">Filter Kondisi:</span>
          <Select
            value={stockFilter}
            onChange={(e) => { setStockFilter(e.target.value); setPage(1); }}
          >
            <option value="all">Semua Kondisi</option>
            <option value="HABIS">Stok Habis</option>
            <option value="KRITIS">Stok Kritis</option>
            <option value="MENIPIS">Stok Menipis</option>
          </Select>
        </div>
      </Card>

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
                  <th className="px-4 py-2.5 text-right">Min Stok</th>
                  <th className="px-4 py-2.5 text-right">Perlu Beli</th>
                  <th className="px-4 py-2.5 text-right" title="Total terjual 30 hari terakhir ÷ 30">Laju Jual/Hari</th>
                  <th className="px-4 py-2.5 text-right" title="Prediksi berapa hari lagi stok akan habis jika laju jual tetap sama (= Stok ÷ Laju Jual/Hari). Merah <7 hari, kuning <14 hari.">Estimasi Habis</th>
                  <th className="px-4 py-2.5">Status</th>
                  {isAdmin && <th className="px-4 py-2.5 text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedItems.map((it, index) => (
                  <tr key={it.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 text-xs text-slate-400">{(page - 1) * PAGE_SIZE + index + 1}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{it.kode_barang}</td>
                    <td className="px-4 py-2.5">
                      {it.nama_barang}
                      <span className="block text-xs text-slate-400">{it.merk || "-"}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold">{angka(it.stok)}</td>
                    <td className="px-4 py-2.5 text-right">{angka(it.min_stock)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-red-600">{angka(it.kekurangan)} unit</td>
                    <td className="px-4 py-2.5 text-right">
                      {Number(it.avg_sales_30d || 0) === 0 ? (
                        <span className="text-slate-400 text-xs">Belum ada data</span>
                      ) : (
                        <span>{Number(it.avg_sales_30d).toFixed(2)}<span className="text-slate-400 text-xs"> unit/hr</span></span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {it.estimasi_hari_habis == null ? (
                        <span className="text-slate-400 text-xs">Belum terjual 30h</span>
                      ) : Number(it.estimasi_hari_habis) <= 7 ? (
                        <span className="font-semibold text-red-600">{it.estimasi_hari_habis} hari</span>
                      ) : Number(it.estimasi_hari_habis) <= 14 ? (
                        <span className="font-semibold text-amber-600">{it.estimasi_hari_habis} hari</span>
                      ) : (
                        <span className="text-slate-700">{it.estimasi_hari_habis} hari</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">{urgensiBadge(it.tingkat_urgensi)}</td>
                    {isAdmin && (
                      <td className="px-4 py-2.5">
                        <div className="flex justify-end">
                          <button
                            onClick={() => setDetailItem(it)}
                            className="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-slate-100 transition"
                            title="Lihat detail & ubah min. stok"
                          >
                            <svg className="w-4 h-4 text-slate-600 hover:text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
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
              Previous
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
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
          {!isAdmin && " (Hanya admin yang dapat mengubah min. stok.)"}
        </p>
      </div>

      {isAdmin && (
        <RestockDetailModal
          item={detailItem}
          onClose={() => setDetailItem(null)}
        />
      )}
    </PageShell>
  );
}

function RestockDetailModal({ item, onClose }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [value, setValue] = useState("");
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
      toast.success(`Min. stok "${item?.nama_barang}" diperbarui`);
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  if (!item) return null;

  if (value === "" || value === undefined) {
    setTimeout(() => setValue(item.min_stock), 0);
  }

  return (
    <Modal
      open={!!item}
      onClose={() => { onClose(); setValue(""); setAlasan(""); }}
      title="Detail Produk & Ubah Min. Stok"
      width="max-w-lg"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-xs text-slate-400">Kode Barang</span>
            <p className="font-mono font-medium">{item.kode_barang}</p>
          </div>
          <div>
            <span className="text-xs text-slate-400">Nama Barang</span>
            <p className="font-medium">{item.nama_barang}</p>
          </div>
          <div>
            <span className="text-xs text-slate-400">Merk</span>
            <p>{item.merk || "-"}</p>
          </div>
          <div>
            <span className="text-xs text-slate-400">Status</span>
            <div className="mt-0.5">{urgensiBadge(item.tingkat_urgensi)}</div>
          </div>
        </div>

        <div className="rounded-lg bg-slate-50 p-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-xs text-slate-400">Stok Saat Ini</span>
              <p className="text-lg font-bold">{angka(item.stok)}</p>
            </div>
            <div>
              <span className="text-xs text-slate-400">Min Stok</span>
              <p className="text-lg font-bold">{angka(item.min_stock)}</p>
            </div>
            <div>
              <span className="text-xs text-slate-400">Perlu Beli</span>
              <p className="font-semibold text-red-600">{angka(item.kekurangan)} unit</p>
            </div>
            <div>
              <span className="text-xs text-slate-400">Laju Jual/Hari</span>
              <p>
                {Number(item.avg_sales_30d || 0) === 0
                  ? "Belum ada data"
                  : `${Number(item.avg_sales_30d).toFixed(2)} unit/hr`}
              </p>
            </div>
            <div>
              <span className="text-xs text-slate-400">Estimasi Habis</span>
              <p>
                {item.estimasi_hari_habis == null
                  ? "Belum terjual 30h"
                  : `${item.estimasi_hari_habis} hari`}
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-3 space-y-3">
          <h4 className="text-sm font-semibold text-slate-700">Ubah Min. Stok</h4>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Min Stok Baru</label>
            <input
              type="number"
              min="0"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Alasan Perubahan <span className="text-red-500">*</span></label>
            <input
              type="text"
              placeholder="Alasan perubahan min. stok..."
              value={alasan}
              onChange={(e) => setAlasan(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500 placeholder:text-slate-400"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => { onClose(); setValue(""); setAlasan(""); }}>
              Batal
            </Button>
            <Button
              size="sm"
              onClick={() => save.mutate()}
              disabled={save.isPending || !alasan.trim()}
            >
              {save.isPending ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
