"use client";
// Modal detail satu nota pembelian supplier (item + diskon nota).

import { Modal, Button, Spinner } from "@/components/ui";
import { rupiah } from "@/lib/format";

export function PurchaseDetailModal({ detailPurchase, loading, onClose }) {
  return (
    <Modal
      open={Boolean(detailPurchase) || loading}
      onClose={onClose}
      title="Detail Nota Pembelian Supplier"
      width="max-w-2xl"
    >
      {loading ? (
        <Spinner label="Memuat detail nota..." />
      ) : detailPurchase ? (
        <div>
          <dl className="mb-4 grid grid-cols-2 gap-x-6 gap-y-1 rounded-lg bg-slate-50 px-4 py-3 text-sm">
            <div>
              <span className="text-xs text-slate-400">No. Nota</span>
              <p className="font-mono font-medium">{detailPurchase.no_nota_supplier || "-"}</p>
            </div>
            <div>
              <span className="text-xs text-slate-400">Tanggal</span>
              <p className="font-medium">{detailPurchase.created_at ? new Date(detailPurchase.created_at).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-"}</p>
            </div>
            <div>
              <span className="text-xs text-slate-400">Status</span>
              <p className="font-medium capitalize">{detailPurchase.status_validasi}</p>
            </div>
            <div>
              <span className="text-xs text-slate-400">Total</span>
              <p className="font-bold text-amber-700">{rupiah(detailPurchase.total)}</p>
            </div>
          </dl>
          {detailPurchase.items && detailPurchase.items.length > 0 && (
            <div className="max-h-72 overflow-auto thin-scroll rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Barang</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-right">Harga Beli</th>
                    <th className="px-3 py-2 text-right">Diskon</th>
                    <th className="px-3 py-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {detailPurchase.items.map((it, i) => {
                    const sub = it.qty * it.harga_beli * (1 - (it.diskon_persen || 0) / 100);
                    return (
                      <tr key={it.id || i} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-xs text-slate-400">{i + 1}</td>
                        <td className="px-3 py-2">
                          <span className="text-xs font-medium">{it.nama_barang || "-"}</span>
                          {it.kode_barang && (
                            <span className="block font-mono text-[10px] text-slate-400">{it.kode_barang}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">{it.qty}</td>
                        <td className="px-3 py-2 text-right">{rupiah(it.harga_beli)}</td>
                        <td className="px-3 py-2 text-right text-amber-600">
                          {Number(it.diskon_persen) > 0 ? `${it.diskon_persen}%` : "-"}
                        </td>
                        <td className="px-3 py-2 text-right font-medium">{rupiah(sub)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {(Number(detailPurchase.diskon_persen) > 0 || Number(detailPurchase.potongan_harga) > 0) && (
            <div className="mt-3 rounded-lg bg-amber-50 px-4 py-2 text-sm">
              {Number(detailPurchase.diskon_persen) > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Diskon Nota ({detailPurchase.diskon_persen}%)</span>
                  <span className="font-medium text-rose-600">
                    −{rupiah(Math.round(detailPurchase.total * detailPurchase.diskon_persen / 100))}
                  </span>
                </div>
              )}
              {Number(detailPurchase.potongan_harga) > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Potongan Harga</span>
                  <span className="font-medium text-rose-600">−{rupiah(detailPurchase.potongan_harga)}</span>
                </div>
              )}
            </div>
          )}
          <div className="mt-4 flex justify-end">
            <Button variant="secondary" onClick={onClose}>Close</Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
