"use client";
// Modal detail transaksi/nota: daftar items + ringkasan diskon/total.

import { Modal, Button } from "@/components/ui";
import { rupiah, angka, tanggalJam } from "@/lib/format";

export function LaporanDetailModal({ detailData, isSales, onClose }) {
  return (
    <Modal
      open={Boolean(detailData)}
      onClose={onClose}
      title={
        detailData
          ? isSales
            ? `Transaksi ${detailData.kode_transaksi}`
            : `Nota ${detailData.no_nota || "(tanpa nomor)"}`
          : "Detail"
      }
      width="max-w-2xl"
    >
      {detailData && (
        <div>
          {/* Header info */}
          <div className="mb-4 grid grid-cols-2 gap-x-6 gap-y-1 rounded-lg bg-slate-50 px-4 py-3 text-sm">
            <div>
              <span className="text-xs text-slate-400">Tanggal</span>
              <p className="font-medium">{tanggalJam(detailData.created_at)}</p>
            </div>
            <div>
              <span className="text-xs text-slate-400">
                {isSales ? "Kasir" : "Diinput Oleh"}
              </span>
              <p className="font-medium">
                {isSales ? detailData.kasir : detailData.user}
              </p>
            </div>
            {!isSales && detailData.status_validasi && (
              <div>
                <span className="text-xs text-slate-400">Status</span>
                <p className="font-medium capitalize">{detailData.status_validasi}</p>
              </div>
            )}
          </div>

          {/* Items table */}
          <div className="max-h-80 overflow-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase text-slate-500">
                {isSales ? (
                  <tr>
                    <th className="px-3 py-2">No</th>
                    <th className="px-3 py-2">Barang</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-right">Harga</th>
                    <th className="px-3 py-2 text-right">Diskon</th>
                    <th className="px-3 py-2 text-right">Subtotal</th>
                  </tr>
                ) : (
                  <tr>
                    <th className="px-3 py-2">No</th>
                    <th className="px-3 py-2">Barang</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-right">Harga Beli</th>
                    <th className="px-3 py-2 text-right">Subtotal</th>
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-slate-100">
                {detailData.items.map((it, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="px-3 py-2 text-xs text-slate-400">{idx + 1}</td>
                    <td className="px-3 py-2">
                      <span className="font-medium">{it.nama_barang}</span>
                      <span className="block font-mono text-xs text-slate-400">
                        {it.kode_barang}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{it.qty}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {rupiah(isSales ? it.harga_satuan : it.harga_beli)}
                    </td>
                    {isSales && (
                      <td className="px-3 py-2 text-right tabular-nums">
                        {Number(it.diskon_persen) > 0 ? (
                          <span className="font-medium text-rose-600">{it.diskon_persen}%</span>
                        ) : (
                          <span className="text-slate-300">0%</span>
                        )}
                      </td>
                    )}
                    <td className="px-3 py-2 text-right font-medium tabular-nums">
                      {rupiah(it.subtotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer total */}
          <div className="mt-3 rounded-lg bg-brand-50 px-4 py-3">
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>
                <span className="font-medium">{detailData.item_count}</span> item
                {" "}·{" "}
                <span className="font-medium">{angka(detailData.total_qty)}</span> qty
              </span>
              {!isSales && (
                <span>
                  Subtotal: <span className="font-medium">{rupiah(detailData.subtotal_before_diskon || detailData.total)}</span>
                </span>
              )}
            </div>
            {!isSales && detailData.nota_diskon_persen > 0 && (
              <div className="mt-2 flex items-center justify-between border-t border-brand-100 pt-2 text-sm">
                <span className="text-slate-500">Diskon ({detailData.nota_diskon_persen}%)</span>
                <span className="font-semibold text-rose-600">
                  −{rupiah(Math.round(detailData.subtotal_before_diskon * detailData.nota_diskon_persen / 100))}
                </span>
              </div>
            )}
            {!isSales && detailData.nota_potongan_harga > 0 && (
              <div className={`flex items-center justify-between text-sm ${detailData.nota_diskon_persen > 0 ? "mt-1" : "mt-2 border-t border-brand-100 pt-2"}`}>
                <span className="text-slate-500">Potongan Harga</span>
                <span className="font-semibold text-rose-600">
                  −{rupiah(detailData.nota_potongan_harga)}
                </span>
              </div>
            )}
            <div className={`flex items-center justify-between ${!isSales ? "mt-2 border-t border-brand-200 pt-2" : "mt-1"}`}>
              <span className="text-sm font-medium text-slate-700">Total</span>
              <p className="text-lg font-bold text-brand-700">
                {rupiah(detailData.total)}
              </p>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
