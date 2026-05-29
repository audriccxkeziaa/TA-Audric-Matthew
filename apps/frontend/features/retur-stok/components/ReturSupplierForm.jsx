"use client";
// Tab "Retur ke Supplier" — pilih nota, centang item, isi qty retur & alasan.

import { Card, Button, Input, ConfirmDialog, Spinner } from "@/components/ui";
import { rupiah, angka, tanggalJam } from "@/lib/format";
import { useReturSupplier } from "../hooks/useReturSupplier";

export function ReturSupplierForm() {
  const r = useReturSupplier();

  if (!r.selected) {
    return (
      <Card className="p-5">
        <h3 className="mb-3 font-semibold text-slate-800">
          Pilih Nota Pembelian Supplier
        </h3>
        <div className="flex gap-2">
          <input
            placeholder="Cari no. nota supplier..."
            value={r.notaQ}
            onChange={(e) => r.setNotaQ(e.target.value)}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
          />
          <Button size="sm" onClick={r.handleBrowse}>Browse</Button>
        </div>

        <div ref={r.listRef} className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
          {r.loading && (
            <div className="py-4 text-center">
              <Spinner />
            </div>
          )}
          {!r.loading && r.filtered.length === 0 && (
            <p className="py-4 text-center text-sm text-slate-400">Tidak ada nota ditemukan</p>
          )}
          {!r.loading &&
            r.filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => r.selectPurchase(p)}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-4 py-3 text-left hover:border-brand-400 hover:bg-brand-50"
              >
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {p.no_nota_supplier || "(tanpa nomor)"}
                  </p>
                  <p className="text-xs text-slate-400">
                    {tanggalJam(p.created_at)} · {p.items?.length || 0} item
                  </p>
                </div>
                <p className="text-sm font-semibold text-slate-700">{rupiah(p.total)}</p>
              </button>
            ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-800">
            Retur Nota: {r.selected.no_nota_supplier || "(tanpa nomor)"}
          </h3>
          <p className="text-xs text-slate-400">{tanggalJam(r.selected.created_at)}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => r.setSelected(null)}>
          Ganti Nota
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-2">Pilih</th>
              <th className="py-2 pr-2">Barang</th>
              <th className="py-2 pr-2 text-right">Qty Beli</th>
              <th className="py-2 pr-2 text-right">Harga Beli</th>
              <th className="py-2 text-right">Qty Retur</th>
            </tr>
          </thead>
          <tbody>
            {r.returnItems.map((it, idx) => (
              <tr key={it.id} className="border-b border-slate-100">
                <td className="py-2 pr-2">
                  <input
                    type="checkbox"
                    checked={it.checked}
                    onChange={() => r.toggleItem(idx)}
                    className="rounded"
                  />
                </td>
                <td className="py-2 pr-2">
                  <p className="font-medium text-slate-800">{it.nama_barang}</p>
                  <p className="text-xs text-slate-400">{it.kode_barang}</p>
                </td>
                <td className="py-2 pr-2 text-right">{angka(it.qty)}</td>
                <td className="py-2 pr-2 text-right">{rupiah(it.harga_beli)}</td>
                <td className="py-2 text-right">
                  {it.checked ? (
                    <input
                      type="number"
                      min={1}
                      max={it.qty}
                      value={it.return_qty}
                      onChange={(e) => r.setQty(idx, parseInt(e.target.value) || 0)}
                      className="w-20 rounded border border-slate-300 px-2 py-1 text-right text-sm"
                    />
                  ) : (
                    <span className="text-slate-300">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Alasan Retur <span className="text-red-500">*</span>
          </label>
          <textarea
            value={r.alasan}
            onChange={(e) => r.setAlasan(e.target.value)}
            placeholder="Contoh: Barang tidak sesuai tipe, jumlah kurang dari nota..."
            rows={2}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <Input
          label="Catatan (opsional)"
          value={r.catatan}
          onChange={(e) => r.setCatatan(e.target.value)}
          placeholder="Catatan tambahan..."
        />
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {r.checkedItems.length} item dipilih · Total qty retur:{" "}
          <strong>{angka(r.checkedItems.reduce((s, it) => s + it.return_qty, 0))}</strong>
        </p>
        <Button
          onClick={() => r.setConfirm(true)}
          disabled={r.checkedItems.length === 0 || !r.alasan.trim() || r.submitting}
          variant="danger"
        >
          {r.submitting ? "Please wait..." : "Confirm Return"}
        </Button>
      </div>

      <ConfirmDialog
        open={r.confirm}
        onClose={() => r.setConfirm(false)}
        onConfirm={r.handleSubmit}
        title="Konfirmasi Retur Supplier"
        message={`Stok ${r.checkedItems.length} barang akan BERKURANG. Lanjutkan?`}
      />
    </Card>
  );
}
