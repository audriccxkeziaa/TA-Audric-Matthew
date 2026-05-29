"use client";
// Modal detail satu transaksi penjualan (header + item + diskon).

import { Modal, Spinner } from "@/components/ui";
import { rupiah } from "@/lib/format";

export function SaleDetailModal({ detailTrx, loading, onClose }) {
  return (
    <Modal
      open={Boolean(detailTrx) || loading}
      onClose={onClose}
      title="Detail Transaksi Penjualan"
    >
      {loading ? (
        <Spinner label="Memuat detail..." />
      ) : detailTrx ? (
        <div>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Kode Transaksi</dt>
              <dd className="font-mono font-medium">{detailTrx.kode_transaksi}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Tanggal & Jam</dt>
              <dd>{detailTrx.created_at ? new Date(detailTrx.created_at).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Kasir</dt>
              <dd className="font-medium">{detailTrx.kasir || "-"}</dd>
            </div>
            {(Number(detailTrx.diskon_persen) > 0 || Number(detailTrx.potongan_harga) > 0) && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Diskon</dt>
                <dd className="text-amber-700">
                  {Number(detailTrx.diskon_persen) > 0 && `${detailTrx.diskon_persen}%`}
                  {Number(detailTrx.diskon_persen) > 0 && Number(detailTrx.potongan_harga) > 0 && " + "}
                  {Number(detailTrx.potongan_harga) > 0 && rupiah(detailTrx.potongan_harga)}
                </dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-slate-500">Total</dt>
              <dd className="font-bold text-emerald-700">{rupiah(detailTrx.total_harga)}</dd>
            </div>
          </dl>
          {detailTrx.items && detailTrx.items.length > 0 && (
            <div className="mt-3 max-h-60 overflow-auto thin-scroll rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Barang</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-right">Harga</th>
                    <th className="px-3 py-2 text-right">Diskon</th>
                    <th className="px-3 py-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {detailTrx.items.map((it, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-3 py-2">
                        <span className="text-xs">{it.nama_barang || "-"}</span>
                        {it.kode_barang && (
                          <span className="ml-1 text-[10px] text-slate-400">({it.kode_barang})</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">{it.qty}</td>
                      <td className="px-3 py-2 text-right">{rupiah(it.harga_satuan)}</td>
                      <td className="px-3 py-2 text-right text-amber-600">{Number(it.diskon_persen) > 0 ? `${it.diskon_persen}%` : "-"}</td>
                      <td className="px-3 py-2 text-right font-medium">{rupiah(it.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </Modal>
  );
}
