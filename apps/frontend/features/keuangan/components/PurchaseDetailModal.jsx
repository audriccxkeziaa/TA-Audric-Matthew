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
              <span className="text-xs text-slate-400">Supplier</span>
              <p className="font-medium">{detailPurchase.supplier_name || "-"}</p>
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
            <div className="col-span-2">
              <span className="text-xs text-slate-400">Alamat Supplier</span>
              <p className="font-medium">{detailPurchase.supplier_address || "-"}</p>
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
                    <th className="px-3 py-2 text-right">Diskon (Rp)</th>
                    <th className="px-3 py-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {detailPurchase.items.map((it, i) => {
                    const pct = Number(it.diskon_persen) || 0;
                    const nominal = Number(it.diskon_nominal) || 0; // Rp per unit
                    const discTotal = Math.round(it.qty * it.harga_beli * pct / 100 + nominal * it.qty);
                    const sub = Math.max(it.qty * it.harga_beli - discTotal, 0);
                    // Catatan asal diskon (mis. "21%" / "Rp 10.000/unit")
                    const notes = [];
                    if (pct > 0) notes.push(`${pct}%`);
                    if (nominal > 0) notes.push(`${rupiah(nominal)}/unit`);
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
                        <td className="px-3 py-2 text-right">
                          {discTotal > 0 ? (
                            <>
                              <span className="font-medium text-amber-600">−{rupiah(discTotal)}</span>
                              <span className="block text-[10px] text-slate-400">{notes.join(" + ")}</span>
                            </>
                          ) : (
                            <span className="text-slate-300">{rupiah(0)}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-medium">{rupiah(sub)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {detailPurchase.items && detailPurchase.items.length > 0 && (() => {
            // Subtotal setelah diskon per barang (% + Rp/unit) — basis diskon nota (sama seperti DB).
            const subtotalItems = detailPurchase.items.reduce((s, it) => {
              const pct = Number(it.diskon_persen) || 0;
              const nominal = Number(it.diskon_nominal) || 0;
              const discTotal = Math.round(it.qty * it.harga_beli * pct / 100 + nominal * it.qty);
              return s + Math.max(it.qty * it.harga_beli - discTotal, 0);
            }, 0);
            const notaPct = Math.min(Number(detailPurchase.diskon_persen) || 0, 100);
            const notaDiskonNilai = Math.round(subtotalItems * notaPct / 100);
            const potongan = Number(detailPurchase.potongan_harga) || 0;
            return (
              <dl className="mt-3 space-y-1.5 rounded-lg bg-slate-50 px-4 py-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Subtotal ({detailPurchase.items.length} item)</dt>
                  <dd className="font-medium text-slate-700">{rupiah(subtotalItems)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Diskon nota ({notaPct}%)</dt>
                  <dd className="font-medium text-rose-600">
                    {notaDiskonNilai > 0 ? `−${rupiah(notaDiskonNilai)}` : rupiah(0)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Potongan harga</dt>
                  <dd className="font-medium text-rose-600">
                    {potongan > 0 ? `−${rupiah(potongan)}` : rupiah(0)}
                  </dd>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2">
                  <dt className="font-semibold text-slate-700">Total</dt>
                  <dd className="font-bold text-amber-700">{rupiah(detailPurchase.total)}</dd>
                </div>
              </dl>
            );
          })()}
          <div className="mt-4 flex justify-end">
            <Button variant="secondary" onClick={onClose}>Close</Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
