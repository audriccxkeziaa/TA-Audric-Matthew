"use client";
// Tabel rekomendasi restock. Kolom Aksi (detail) hanya untuk admin.

import { Card, Spinner, EmptyState } from "@/components/ui";
import { angka } from "@/lib/format";
import { UrgensiBadge } from "./UrgensiBadge";

export function RestockTable({
  rows,
  isEmpty,
  isLoading,
  isAdmin,
  page,
  pageSize,
  onDetail,
}) {
  return (
    <Card className="flex min-h-0 flex-1 flex-col p-0">
      {isLoading ? (
        <div className="p-6">
          <Spinner label="Memuat rekomendasi..." />
        </div>
      ) : isEmpty ? (
        <EmptyState
          title="Tidak ada barang yang perlu restock"
          description="Semua stok di atas ambang minimum."
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-auto thin-scroll">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
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
              {rows.map((it, index) => (
                <tr key={it.id} className="transition-colors hover:bg-brand-50/40">
                  <td className="px-4 py-2.5 text-xs text-slate-400">{(page - 1) * pageSize + index + 1}</td>
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
                  <td className="px-4 py-2.5"><UrgensiBadge level={it.tingkat_urgensi} /></td>
                  {isAdmin && (
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end">
                        <button
                          onClick={() => onDetail(it)}
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
  );
}
