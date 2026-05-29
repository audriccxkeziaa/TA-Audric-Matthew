"use client";
// Tab "Penyesuaian Stok" (admin) — catat penyusutan: stok berkurang.

import { Card, Button, Input, ConfirmDialog, EmptyState } from "@/components/ui";
import { rupiah, angka } from "@/lib/format";
import ProductPicker from "@/components/ProductPicker";
import { usePenyesuaianStok } from "../hooks/usePenyesuaianStok";

export function PenyesuaianStokForm() {
  const p = usePenyesuaianStok();

  return (
    <Card className="p-5">
      <div className="mb-3 rounded-lg bg-amber-50 px-4 py-2.5 text-xs text-amber-700">
        <strong>Penyesuaian Stok (Penyusutan):</strong> Gunakan fitur ini untuk
        mencatat barang yang rusak, pecah, hilang, atau penyusutan stok di toko.
        Stok akan <strong>berkurang</strong> sesuai jumlah yang diinput.
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-slate-800">Daftar Barang</h3>
        <Button size="sm" onClick={() => p.setPickerOpen(true)}>
          + Tambah Item
        </Button>
      </div>

      {p.items.length === 0 ? (
        <EmptyState
          title="Belum ada barang"
          description="Klik 'Tambah Item' untuk memilih barang yang akan disesuaikan"
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-2">Barang</th>
                <th className="py-2 pr-2 text-right">Stok Saat Ini</th>
                <th className="py-2 pr-2 text-right">Harga Beli</th>
                <th className="py-2 pr-2 text-right">Qty Dikurangi</th>
                <th className="py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {p.items.map((it, idx) => (
                <tr key={it.product_id} className="border-b border-slate-100">
                  <td className="py-2 pr-2">
                    <p className="font-medium text-slate-800">{it.nama_barang}</p>
                    <p className="text-xs text-slate-400">
                      {it.kode_barang} · {it.merk || "-"}
                    </p>
                  </td>
                  <td className="py-2 pr-2 text-right">{angka(it.stok)}</td>
                  <td className="py-2 pr-2 text-right">{rupiah(it.harga_beli)}</td>
                  <td className="py-2 pr-2 text-right">
                    <input
                      type="number"
                      min={1}
                      max={it.stok}
                      value={it.qty}
                      onChange={(e) => p.setQty(idx, parseInt(e.target.value) || 1)}
                      className="w-20 rounded border border-slate-300 px-2 py-1 text-right text-sm"
                    />
                  </td>
                  <td className="py-2 text-center">
                    <button
                      onClick={() => p.removeItem(idx)}
                      className="text-red-400 hover:text-red-600"
                      title="Hapus"
                    >
                      &times;
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Alasan Penyesuaian <span className="text-red-500">*</span>
          </label>
          <textarea
            value={p.alasan}
            onChange={(e) => p.setAlasan(e.target.value)}
            placeholder="Contoh: Barang pecah tersenggol, rusak karena kelembaban, hilang saat stock opname..."
            rows={2}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <Input
          label="Catatan (opsional)"
          value={p.catatan}
          onChange={(e) => p.setCatatan(e.target.value)}
          placeholder="Catatan tambahan..."
        />
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {p.items.length} barang · Total qty dikurangi: <strong>{angka(p.totalQty)}</strong>
        </p>
        <Button
          onClick={() => p.setConfirm(true)}
          disabled={p.items.length === 0 || !p.alasan.trim() || p.submitting}
          variant="danger"
        >
          {p.submitting ? "Loading..." : "Konfirmasi Penyesuaian"}
        </Button>
      </div>

      <ConfirmDialog
        open={p.confirm}
        onClose={() => p.setConfirm(false)}
        onConfirm={p.handleSubmit}
        title="Konfirmasi Penyesuaian Stok"
        message={`Stok ${p.items.length} barang akan BERKURANG sebanyak ${angka(p.totalQty)} unit total. Tindakan ini tidak bisa dibatalkan. Lanjutkan?`}
        tone="danger"
      />

      <ProductPicker
        open={p.pickerOpen}
        onClose={() => p.setPickerOpen(false)}
        onSelect={p.addProduct}
      />
    </Card>
  );
}
