"use client";
// Tabel keranjang + footer total. Qty editable, diskon per item, hapus baris.
// Baris merah = qty melebihi stok (akan ditolak R1 di backend).
//
// Responsif:
//   - Desktop (md+) : tabel penuh seperti semula (tidak diubah).
//   - HP (< md)     : tiap item jadi "kartu" tersusun ke bawah (tanpa geser samping).
// Footer total menyesuaikan: tombol checkout full-width di HP.

import { Card, Button, EmptyState } from "@/components/ui";
import { rupiah, angka } from "@/lib/format";

// Stepper qty dipakai di tabel & kartu — diekstrak agar perilaku konsisten.
function QtyStepper({ x, setQty, lastQtyRef }) {
  return (
    <div className="flex items-center justify-center gap-1">
      <button
        onClick={() => setQty(x.id, x.qty - 1)}
        className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-lg font-bold text-slate-600 transition-colors hover:bg-brand-100 hover:text-brand-700"
        aria-label="Kurangi qty"
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
        className="h-8 w-14 rounded-md border border-slate-300 text-center text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
      />
      <button
        onClick={() => setQty(x.id, x.qty + 1)}
        className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-lg font-bold text-slate-600 transition-colors hover:bg-brand-100 hover:text-brand-700"
        aria-label="Tambah qty"
      >
        +
      </button>
    </div>
  );
}

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
  const empty = cart.length === 0;

  return (
    <Card className="mt-3 flex flex-col p-0 md:min-h-0 md:flex-1">
      <div className="overflow-auto thin-scroll md:min-h-0 md:flex-1">
        {/* ===== Tampilan DESKTOP (md+) — tabel penuh ===== */}
        <table className="hidden w-full min-w-[720px] text-sm md:table">
          <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
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
            {empty ? (
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
                  <tr key={x.id} className={over ? "bg-red-50" : "transition-colors hover:bg-brand-50/40"}>
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
                      <QtyStepper x={x} setQty={setQty} lastQtyRef={lastQtyRef} />
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
                        className="h-7 w-16 rounded-md border border-slate-300 text-center text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
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
                        className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        title="Hapus"
                        aria-label="Hapus item"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          <line x1="10" y1="11" x2="10" y2="17" />
                          <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* ===== Tampilan HP (< md) — kartu per item ===== */}
        <div className="md:hidden">
          {empty ? (
            <EmptyState
              title="Keranjang kosong"
              description="Scan barcode / ketik kode di atas, atau tekan Browse untuk mencari."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {cart.map((x, i) => {
                const over = x.qty > x.stok;
                return (
                  <li key={x.id} className={`p-3 ${over ? "bg-red-50" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800">
                          <span className="mr-1 text-xs text-slate-400">{i + 1}.</span>
                          {x.nama_barang}
                        </p>
                        <p className="font-mono text-xs text-slate-400">{x.kode_barang}</p>
                      </div>
                      <button
                        onClick={() => removeItem(x.id)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        title="Hapus"
                        aria-label="Hapus item"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          <line x1="10" y1="11" x2="10" y2="17" />
                          <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                      </button>
                    </div>

                    {over && (
                      <p className="mt-1 text-xs text-red-600">
                        Qty melebihi stok ({angka(x.stok)}) — akan ditolak R1
                      </p>
                    )}

                    <div className="mt-2 flex items-center justify-between gap-2">
                      <QtyStepper x={x} setQty={setQty} lastQtyRef={lastQtyRef} />
                      <label className="flex items-center gap-1 text-xs text-slate-500">
                        Disc%
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          value={x.diskon_persen || 0}
                          onChange={(e) => setDiskon(x.id, e.target.value)}
                          onFocus={(e) => e.target.select()}
                          className="h-8 w-16 rounded-md border border-slate-300 text-center text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
                          title="Diskon (%) — default 0"
                        />
                      </label>
                    </div>

                    <div className="mt-2 flex items-end justify-between text-sm">
                      <span className="text-xs text-slate-500">
                        @ {rupiah(x.harga_jual)}
                      </span>
                      <span className="text-right font-semibold text-slate-900">
                        {rupiah(lineSubtotal(x))}
                        {x.diskon_persen > 0 && (
                          <span className="ml-1 text-[10px] font-normal text-slate-400 line-through">
                            {rupiah(x.harga_jual * x.qty)}
                          </span>
                        )}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Footer total — selalu terlihat */}
      <div className="safe-bottom shrink-0 border-t border-slate-200 bg-slate-50/80 px-4 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
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
          <div className="flex items-center justify-between gap-4 sm:justify-end">
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
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Total</p>
              <p className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                {rupiah(total)}
              </p>
            </div>
            <Button
              size="lg"
              variant="success"
              loading={saleProcessing}
              disabled={cart.length === 0 || overStock.length > 0 || saleProcessing}
              onClick={onCheckout}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12l5 5L20 7" />
              </svg>
              <span className="hidden sm:inline">CHECKOUT (F12)</span>
              <span className="sm:hidden">CHECKOUT</span>
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
