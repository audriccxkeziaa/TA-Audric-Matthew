"use client";
// Tabel daftar barang. Isi tabel yang scroll; kartu mengisi sisa tinggi.
// Tombol edit hanya tampil untuk admin.

import { Card, Badge, Skeleton, EmptyState } from "@/components/ui";
import { rupiah, angka } from "@/lib/format";

// Badge kondisi stok berdasarkan stok vs min_stock.
function stokBadge(p) {
  if (Number(p.stok) === 0) return <Badge tone="red">Stok Habis</Badge>;
  if (Number(p.stok) <= Number(p.min_stock))
    return <Badge tone="amber">Stok Menipis</Badge>;
  return <Badge tone="green">Normal</Badge>;
}

export function ProductTable({ products, isLoading, isAdmin, page, onEdit }) {
  return (
    <Card className="flex flex-col p-0 md:min-h-0 md:flex-1">
      {isLoading ? (
        <div className="p-4">
          <Skeleton rows={6} />
        </div>
      ) : products.length === 0 ? (
        <EmptyState
          title="Belum ada barang"
          description="Tambahkan barang atau ubah filter pencarian."
        />
      ) : (
        <div className="overflow-auto thin-scroll md:min-h-0 md:flex-1">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2.5 w-8">No</th>
                <th className="px-4 py-2.5">Kode</th>
                <th className="px-4 py-2.5">Nama Barang</th>
                <th className="px-4 py-2.5">Merk</th>
                <th className="px-4 py-2.5 text-right">Harga Beli</th>
                <th className="px-4 py-2.5 text-right">Harga Jual</th>
                <th className="px-4 py-2.5 text-right">Stok</th>
                <th className="px-4 py-2.5 text-right">Min Stok</th>
                <th className="px-4 py-2.5">Kondisi</th>
                {isAdmin && <th className="px-4 py-2.5 text-center">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((p, index) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 text-xs text-slate-400">
                    {(page - 1) * 20 + index + 1}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs">
                    {p.kode_barang}
                  </td>
                  <td className="px-4 py-2.5">
                    {p.nama_barang}
                    {p.status === "nonaktif" && (
                      <span className="ml-2">
                        <Badge tone="slate">nonaktif</Badge>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{p.merk || "-"}</td>
                  <td className="px-4 py-2.5 text-right">
                    {rupiah(p.harga_beli)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {rupiah(p.harga_jual)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold">
                    {angka(p.stok)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-500">
                    {angka(p.min_stock)}
                  </td>
                  <td className="px-4 py-2.5">{stokBadge(p)}</td>
                  {isAdmin && (
                    <td className="px-4 py-2.5 text-center">
                      <button
                        onClick={() => onEdit(p)}
                        className="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-slate-100 transition"
                        title="Edit barang"
                      >
                        <svg
                          className="w-4 h-4 text-slate-600 hover:text-brand-600"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </button>
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
