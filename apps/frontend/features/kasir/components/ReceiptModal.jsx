"use client";
// Modal struk hasil transaksi. Tombol cetak via lib/receipt.

import { Modal, Button } from "@/components/ui";
import { rupiah } from "@/lib/format";
import { printReceipt } from "@/lib/receipt";

export function ReceiptModal({ receipt, onClose }) {
  return (
    <Modal
      open={Boolean(receipt)}
      onClose={onClose}
      title="Transaksi Berhasil"
    >
      {receipt && (
        <div>
          <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Transaksi <b>{receipt.kode_transaksi}</b> tersimpan. Stok sudah
            diperbarui otomatis.
          </div>
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-400">
              <tr>
                <th className="py-1">Barang</th>
                <th className="py-1 text-right">Qty</th>
                <th className="py-1 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {receipt.items.map((it) => (
                <tr key={it.id}>
                  <td className="py-1.5">{it.nama_barang}</td>
                  <td className="py-1.5 text-right">{it.qty}</td>
                  <td className="py-1.5 text-right">{rupiah(it.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 font-bold">
            <span>Total</span>
            <span>{rupiah(receipt.total_harga)}</span>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Button onClick={() => printReceipt(receipt)}>Print Receipt</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
