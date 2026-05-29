"use client";
// Popup drill-down detail satu transaksi penjualan / satu nota pembelian.
// Dipakai di dalam modal metric (Transaksi, Revenue, Stok Masuk).

import { useQuery } from "@tanstack/react-query";
import { salesApi, purchasesApi } from "@/lib/api";
import { rupiah, tanggal } from "@/lib/format";
import { Spinner, EmptyState } from "@/components/ui";

export function SaleDetailPopup({ saleId, onBack }) {
  const q = useQuery({
    queryKey: ["sale-detail", saleId],
    queryFn: () => salesApi.get(saleId),
    enabled: !!saleId,
  });
  const sale = q.data?.data;
  if (q.isLoading) return <Spinner label="Memuat detail..." />;
  if (!sale) return <EmptyState title="Detail tidak ditemukan" />;
  return (
    <div>
      <button onClick={onBack} className="mb-3 flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-800">
        <svg className="h-3 w-3 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
        Kembali
      </button>
      <div className="mb-3 rounded-lg bg-slate-50 px-4 py-3 text-sm">
        <p className="font-mono text-xs font-semibold text-brand-700">{sale.kode_transaksi}</p>
        <p className="text-xs text-slate-500">{tanggal(sale.created_at)}</p>
      </div>
      <div className="max-h-64 overflow-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Barang</th>
              <th className="px-3 py-2 text-right">Qty</th>
              <th className="px-3 py-2 text-right">Harga</th>
              <th className="px-3 py-2 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(sale.items || []).map((it, i) => (
              <tr key={it.id || i}>
                <td className="px-3 py-2 text-xs text-slate-400">{i + 1}</td>
                <td className="px-3 py-2">
                  <span className="font-medium">{it.nama_barang}</span>
                  <span className="block font-mono text-xs text-slate-400">{it.kode_barang}</span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{it.qty}</td>
                <td className="px-3 py-2 text-right tabular-nums">{rupiah(it.harga_satuan)}</td>
                <td className="px-3 py-2 text-right font-medium tabular-nums">{rupiah(it.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex justify-end rounded-lg bg-brand-50 px-4 py-3">
        <p className="text-lg font-bold text-brand-700">{rupiah(sale.total_harga)}</p>
      </div>
    </div>
  );
}

export function PurchaseDetailPopup({ purchaseId, onBack }) {
  const q = useQuery({
    queryKey: ["purchase-detail", purchaseId],
    queryFn: () => purchasesApi.get(purchaseId),
    enabled: !!purchaseId,
  });
  const p = q.data?.data;
  if (q.isLoading) return <Spinner label="Memuat detail..." />;
  if (!p) return <EmptyState title="Detail tidak ditemukan" />;
  return (
    <div>
      <button onClick={onBack} className="mb-3 flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-800">
        <svg className="h-3 w-3 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
        Kembali
      </button>
      <div className="mb-3 rounded-lg bg-slate-50 px-4 py-3 text-sm">
        <p className="font-mono text-xs font-semibold text-brand-700">{p.no_nota_supplier || "(tanpa nomor)"}</p>
        <p className="text-xs text-slate-500">{tanggal(p.created_at)}</p>
      </div>
      <div className="max-h-64 overflow-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Barang</th>
              <th className="px-3 py-2 text-right">Qty</th>
              <th className="px-3 py-2 text-right">Harga Beli</th>
              <th className="px-3 py-2 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(p.items || []).map((it, i) => {
              const sub = it.qty * it.harga_beli * (1 - (it.diskon_persen || 0) / 100);
              return (
                <tr key={it.id || i}>
                  <td className="px-3 py-2 text-xs text-slate-400">{i + 1}</td>
                  <td className="px-3 py-2">
                    <span className="font-medium">{it.nama_barang}</span>
                    <span className="block font-mono text-xs text-slate-400">{it.kode_barang}</span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{it.qty}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{rupiah(it.harga_beli)}</td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">{rupiah(sub)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex justify-end rounded-lg bg-brand-50 px-4 py-3">
        <p className="text-lg font-bold text-brand-700">{rupiah(p.total)}</p>
      </div>
    </div>
  );
}
