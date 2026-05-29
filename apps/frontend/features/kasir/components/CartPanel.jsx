"use client";
// Tabel keranjang + footer total. Qty editable, diskon per item, hapus baris.
// Baris merah = qty melebihi stok (akan ditolak R1 di backend).

import { Card, Button, EmptyState } from "@/components/ui";
import { rupiah, angka } from "@/lib/format";

export function CartPanel({
  cart,
  setQty,
  setDiskon,
  removeItem,
  lineSubtotal,
  lastQtyRef,
  subtotal,
  totalDiskon,
  total,
  totalQty,
  overStock,
  clearCart,
  onCheckout,
  saleProcessing,
}) {
  return (
    <Card className="mt-3 flex flex-col p-0 md:min-h-0 md:flex-1">
      <div className="overflow-auto thin-scroll md:min-h-0 md:flex-1">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="sticky top-0 bg-slate-100 text-left text-xs uppercase text-slate-600">
            <tr>
              <th className="px-3 py-2.5 text-center">No</th>
              <th className="px-3 py-2.5">Kode Barang</th>
              <th className="px-3 py-2.5">Nama Barang</th>
              <th className="px-3 py-2.5 text-center">Qty</th>
              <th className="px-3 py-2.5 text-right">Harga Beli</th>
              <th className="px-3 py-2.5 text-right">Harga Jual</th>
              <th className="px-3 py-2.5 text-center">Disc %</th>
              <th className="px-3 py-2.5 text-right">Subtotal</th>
              <th className="px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cart.length === 0 ? (
              <tr>
                <td colSpan={9}>
                  <EmptyState
                    title="Keranjang kosong"
                    description="Scan barcode atau ketik kode di atas, atau tekan F2 untuk mencari."
                  />
                </td>
              </tr>
            ) : (
              cart.map((x, i) => {
                const over = x.qty > x.stok;
                return (
                  <tr key={x.id} className={over ? "bg-red-50" : "hover:bg-slate-50"}>
                    <td className="px-3 py-2.5 text-center text-slate-400">{i + 1}</td>
                    <td className="px-3 py-2.5 font-mono text-xs">{x.kode_barang}</td>
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-slate-800">{x.nama_barang}</p>
                      {over && (
                        <p className="text-xs text-red-600">
                          Qty melebihi stok ({angka(x.stok)}) — akan ditolak R1
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setQty(x.id, x.qty - 1)}
                          className="h-7 w-7 rounded bg-slate-200 font-bold text-slate-700 hover:bg-slate-300"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min="1"
                          value={x.qty}
                          onChange={(e) => {
                            const n = parseInt(e.target.value, 10) || 1;
                            setQty(x.id, n);
                            lastQtyRef.current = n;
                          }}
                          className="h-7 w-14 rounded border border-slate-300 text-center text-sm"
                        />
                        <button
                          onClick={() => setQty(x.id, x.qty + 1)}
                          className="h-7 w-7 rounded bg-slate-200 font-bold text-slate-700 hover:bg-slate-300"
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-500">{rupiah(x.harga_beli)}</td>
                    <td className="px-3 py-2.5 text-right">{rupiah(x.harga_jual)}</td>
                    <td className="px-3 py-2.5">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={x.diskon_persen || 0}
                        onChange={(e) => setDiskon(x.id, e.target.value)}
                        onFocus={(e) => e.target.select()}
                        className="h-7 w-16 rounded border border-slate-300 text-center text-sm"
                        title="Diskon (%) — default 0"
                      />
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold">
                      {rupiah(lineSubtotal(x))}
                      {x.diskon_persen > 0 && (
                        <p className="text-[10px] font-normal text-slate-400 line-through">
                          {rupiah(x.harga_jual * x.qty)}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        onClick={() => removeItem(x.id)}
                        className="text-xs text-red-500 hover:underline"
                        title="Hapus"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer total — selalu terlihat */}
      <div className="shrink-0 border-t-2 border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
            <span>
              Total Produk: <b className="text-slate-900">{angka(cart.length)}</b>
            </span>
            <span>
              Total Qty: <b className="text-slate-900">{angka(totalQty)}</b>
            </span>
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-xs text-red-600 hover:underline"
              >
                Kosongkan keranjang
              </button>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              {totalDiskon > 0 && (
                <>
                  <p className="text-xs text-slate-500">
                    Subtotal: <span className="line-through">{rupiah(subtotal)}</span>
                  </p>
                  <p className="text-xs font-medium text-emerald-600">
                    Diskon: − {rupiah(totalDiskon)}
                  </p>
                </>
              )}
              <p className="text-xs text-slate-500">TOTAL</p>
              <p className="text-xl font-extrabold text-slate-900 sm:text-3xl">
                {rupiah(total)}
              </p>
            </div>
            <Button
              size="lg"
              disabled={cart.length === 0 || overStock.length > 0 || saleProcessing}
              onClick={onCheckout}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              💰 CHECKOUT (F12)
            </Button>
          </div>
        </div>
        {overStock.length > 0 && (
          <p className="mt-1.5 text-right text-xs text-red-600">
            {overStock.length} barang melebihi stok — perbaiki dulu.
          </p>
        )}
      </div>
    </Card>
  );
}
