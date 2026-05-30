"use client";
// Tabel daftar barang. Isi tabel yang scroll; kartu mengisi sisa tinggi.
// Tombol edit hanya tampil untuk admin.
//
// Responsif:
//   - Desktop (md+) : tabel penuh seperti semula (tidak diubah).
//   - HP (< md)     : tiap barang jadi "kartu" ringkas (tanpa geser samping).

import { Card, Badge, Skeleton, EmptyState, Table, THead, TH, TBody, TR, TD } from "@/components/ui";
import { rupiah, angka } from "@/lib/format";

// Badge kondisi stok berdasarkan stok vs min_stock.
function stokBadge(p) {
  if (Number(p.stok) === 0) return <Badge tone="red">Stok Habis</Badge>;
  if (Number(p.stok) <= Number(p.min_stock))
    return <Badge tone="amber">Stok Menipis</Badge>;
  return <Badge tone="green">Normal</Badge>;
}

// Ikon mata (lihat/edit) — dipakai di tabel & kartu.
function EditIcon() {
  return (
    <svg
      className="h-4 w-4 text-slate-600 hover:text-brand-600"
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
  );
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
          {/* ===== Tampilan DESKTOP (md+) ===== */}
          <Table className="min-w-[640px]">
            <THead>
              <TH className="w-8">No</TH>
              <TH>Kode</TH>
              <TH>Nama Barang</TH>
              <TH>Merk</TH>
              <TH className="text-right">Harga Beli</TH>
              <TH className="text-right">Harga Jual</TH>
              <TH className="text-right">Stok</TH>
              <TH className="text-right">Min Stok</TH>
              <TH>Kondisi</TH>
              {isAdmin && <TH className="text-center">Aksi</TH>}
            </THead>
            <TBody>
              {products.map((p, index) => (
                <TR key={p.id}>
                  <TD className="text-xs text-slate-400">
                    {(page - 1) * 20 + index + 1}
                  </TD>
                  <TD className="font-mono text-xs">
                    {p.kode_barang}
                  </TD>
                  <TD>
                    {p.nama_barang}
                    {p.status === "nonaktif" && (
                      <span className="ml-2">
                        <Badge tone="slate">nonaktif</Badge>
                      </span>
                    )}
                  </TD>
                  <TD className="text-slate-500">{p.merk || "-"}</TD>
                  <TD className="text-right">
                    {rupiah(p.harga_beli)}
                  </TD>
                  <TD className="text-right">
                    {rupiah(p.harga_jual)}
                  </TD>
                  <TD className="text-right font-semibold">
                    {angka(p.stok)}
                  </TD>
                  <TD className="text-right text-slate-500">
                    {angka(p.min_stock)}
                  </TD>
                  <TD>{stokBadge(p)}</TD>
                  {isAdmin && (
                    <TD className="text-center">
                      <button
                        onClick={() => onEdit(p)}
                        className="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-slate-100 transition"
                        title="Edit barang"
                      >
                        <EditIcon />
                      </button>
                    </TD>
                  )}
                </TR>
              ))}
            </TBody>
          </Table>

          {/* ===== Tampilan HP (< md) — kartu per barang ===== */}
          <ul className="divide-y divide-slate-100 md:hidden">
            {products.map((p, index) => (
              <li key={p.id} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800">
                      <span className="mr-1 text-xs text-slate-400">
                        {(page - 1) * 20 + index + 1}.
                      </span>
                      {p.nama_barang}
                      {p.status === "nonaktif" && (
                        <span className="ml-2 align-middle">
                          <Badge tone="slate">nonaktif</Badge>
                        </span>
                      )}
                    </p>
                    <p className="font-mono text-xs text-slate-400">
                      {p.kode_barang} · {p.merk || "-"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {stokBadge(p)}
                    {isAdmin && (
                      <button
                        onClick={() => onEdit(p)}
                        className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100 transition"
                        title="Edit barang"
                        aria-label="Edit barang"
                      >
                        <EditIcon />
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                  <span className="text-slate-500">Harga Jual</span>
                  <span className="text-right font-semibold text-slate-900">
                    {rupiah(p.harga_jual)}
                  </span>
                  <span className="text-slate-500">Harga Beli</span>
                  <span className="text-right text-slate-600">
                    {rupiah(p.harga_beli)}
                  </span>
                  <span className="text-slate-500">Stok / Min</span>
                  <span className="text-right text-slate-600">
                    <b className="text-slate-900">{angka(p.stok)}</b> / {angka(p.min_stock)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
