"use client";
// Tabel rekomendasi restock. Kolom Aksi (detail) hanya untuk admin.

import { Card, Spinner, EmptyState, Badge, Table, THead, TH, TBody, TR, TD } from "@/components/ui";
import { angka } from "@/lib/format";
import { UrgensiBadge } from "./UrgensiBadge";

function PencilIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

export function RestockTable({
  rows,
  isEmpty,
  isLoading,
  isAdmin,
  page,
  pageSize,
  onDetail,
  onEdit,
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
          {/* ===== Tampilan DESKTOP (md+) ===== */}
          <Table>
            <THead>
              <TH className="w-8">No</TH>
              <TH>Kode Barang</TH>
              <TH>Nama Barang</TH>
              <TH className="text-right">Stok</TH>
              <TH className="text-right">Min Stok</TH>
              <TH className="text-right">Perlu Beli</TH>
              <TH className="text-right" title="Total terjual 30 hari terakhir ÷ 30">Laju Jual/Hari</TH>
              <TH className="text-right" title="Prediksi berapa hari lagi stok akan habis jika laju jual tetap sama (= Stok ÷ Laju Jual/Hari). Merah <7 hari, kuning <14 hari.">Estimasi Habis</TH>
              <TH className="text-center" title="Reorder Point (ROP): batas stok sebelum harus pesan ulang agar tidak kehabisan. ROP = (laju jual × 3 hari lead time) + (laju jual × 2 hari safety stock). Merah = stok sudah di bawah ROP, pesan segera!">Status ROP</TH>
              <TH>Status</TH>
              {isAdmin && <TH className="text-right">Aksi</TH>}
            </THead>
            <TBody>
              {rows.map((it, index) => (
                <TR key={it.id}>
                  <TD className="text-xs text-slate-400">{(page - 1) * pageSize + index + 1}</TD>
                  <TD className="font-mono text-xs">{it.kode_barang}</TD>
                  <TD>
                    {it.nama_barang}
                    <span className="block text-xs text-slate-400">{it.merk || "-"}</span>
                  </TD>
                  <TD className="text-right font-semibold">{angka(it.stok)}</TD>
                  <TD className="text-right">{angka(it.min_stock)}</TD>
                  <TD className="text-right font-semibold text-red-600">{angka(it.kekurangan)} unit</TD>
                  <TD className="text-right">
                    {Number(it.avg_sales_30d || 0) === 0 ? (
                      <span className="text-slate-400 text-xs">Belum ada data</span>
                    ) : (
                      <span>{Number(it.avg_sales_30d).toFixed(2)}<span className="text-slate-400 text-xs"> unit/hr</span></span>
                    )}
                  </TD>
                  <TD className="text-right">
                    {it.estimasi_hari_habis == null ? (
                      <span className="text-slate-400 text-xs">Belum terjual 30h</span>
                    ) : Number(it.estimasi_hari_habis) <= 7 ? (
                      <span className="font-semibold text-red-600">{it.estimasi_hari_habis} hari</span>
                    ) : Number(it.estimasi_hari_habis) <= 14 ? (
                      <span className="font-semibold text-amber-600">{it.estimasi_hari_habis} hari</span>
                    ) : (
                      <span className="text-slate-700">{it.estimasi_hari_habis} hari</span>
                    )}
                  </TD>
                  <TD className="text-center">
                    {Number(it.avg_sales_30d || 0) === 0 ? (
                      <span className="text-xs text-slate-400">-</span>
                    ) : it.dibawah_rop ? (
                      <div className="flex flex-col items-center gap-0.5">
                        <Badge tone="red">Pesan Sekarang!</Badge>
                        <span className="text-[10px] text-slate-400">ROP: {angka(it.rop)} unit</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-0.5">
                        <Badge tone="green">Aman</Badge>
                        <span className="text-[10px] text-slate-400">ROP: {angka(it.rop)} unit</span>
                      </div>
                    )}
                  </TD>
                  <TD><UrgensiBadge level={it.tingkat_urgensi} /></TD>
                  {isAdmin && (
                    <TD>
                      <div className="flex justify-end gap-0.5">
                        <button
                          onClick={() => onDetail(it)}
                          className="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-slate-100 transition"
                          title="Lihat detail"
                        >
                          <svg className="w-4 h-4 text-slate-600 hover:text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        </button>
                        <button
                          onClick={() => onEdit(it)}
                          className="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-slate-100 transition text-slate-600 hover:text-blue-600"
                          title="Edit min. stok"
                        >
                          <PencilIcon />
                        </button>
                      </div>
                    </TD>
                  )}
                </TR>
              ))}
            </TBody>
          </Table>

          {/* ===== Tampilan HP (< md) — kartu per barang ===== */}
          <ul className="divide-y divide-slate-100 md:hidden">
            {rows.map((it, index) => (
              <li key={it.id} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800">
                      <span className="mr-1 text-xs text-slate-400">
                        {(page - 1) * pageSize + index + 1}.
                      </span>
                      {it.nama_barang}
                    </p>
                    <p className="font-mono text-xs text-slate-400">
                      {it.kode_barang} · {it.merk || "-"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <UrgensiBadge level={it.tingkat_urgensi} />
                    {isAdmin && (
                      <div className="flex gap-0.5">
                        <button
                          onClick={() => onDetail(it)}
                          className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100 transition"
                          title="Lihat detail"
                          aria-label="Lihat detail"
                        >
                          <svg className="h-4 w-4 text-slate-600 hover:text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        </button>
                        <button
                          onClick={() => onEdit(it)}
                          className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100 transition text-slate-600 hover:text-blue-600"
                          title="Edit min. stok"
                          aria-label="Edit min. stok"
                        >
                          <PencilIcon />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                  <span className="text-slate-500">Stok / Min</span>
                  <span className="text-right text-slate-600">
                    <b className="text-slate-900">{angka(it.stok)}</b> / {angka(it.min_stock)}
                  </span>
                  <span className="text-slate-500">Perlu Beli</span>
                  <span className="text-right font-semibold text-red-600">
                    {angka(it.kekurangan)} unit
                  </span>
                  <span className="text-slate-500">Laju Jual/Hari</span>
                  <span className="text-right text-slate-600">
                    {Number(it.avg_sales_30d || 0) === 0
                      ? "Belum ada data"
                      : `${Number(it.avg_sales_30d).toFixed(2)} unit/hr`}
                  </span>
                  <span className="text-slate-500">Estimasi Habis</span>
                  <span className="text-right">
                    {it.estimasi_hari_habis == null ? (
                      <span className="text-xs text-slate-400">Belum terjual 30h</span>
                    ) : Number(it.estimasi_hari_habis) <= 7 ? (
                      <span className="font-semibold text-red-600">{it.estimasi_hari_habis} hari</span>
                    ) : Number(it.estimasi_hari_habis) <= 14 ? (
                      <span className="font-semibold text-amber-600">{it.estimasi_hari_habis} hari</span>
                    ) : (
                      <span className="text-slate-700">{it.estimasi_hari_habis} hari</span>
                    )}
                  </span>
                  <span className="text-slate-500">Status ROP</span>
                  <span className="text-right">
                    {Number(it.avg_sales_30d || 0) === 0 ? (
                      <span className="text-xs text-slate-400">-</span>
                    ) : it.dibawah_rop ? (
                      <Badge tone="red">Pesan Sekarang!</Badge>
                    ) : (
                      <Badge tone="green">Aman</Badge>
                    )}
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
