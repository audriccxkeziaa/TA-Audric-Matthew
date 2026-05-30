"use client";
// Tab "Penyesuaian Stok" (admin) — koreksi stok: bisa bertambah atau berkurang.

import { Card, Button, Textarea, Input, ConfirmDialog, EmptyState } from "@/components/ui";
import { rupiah, angka } from "@/lib/format";
import ProductPicker from "@/components/ProductPicker";
import { usePenyesuaianStok } from "../hooks/usePenyesuaianStok";

export function PenyesuaianStokForm() {
  const p = usePenyesuaianStok();

  const confirmMsg = [
    `Akan memproses penyesuaian ${p.items.length} barang:`,
    p.totalKurang > 0 ? `berkurang ${angka(p.totalKurang)} unit` : null,
    p.totalTambah > 0 ? `bertambah ${angka(p.totalTambah)} unit` : null,
  ]
    .filter(Boolean)
    .join(" · ") + ". Tindakan ini tidak bisa dibatalkan. Lanjutkan?";

  return (
    <Card className="p-5">
      <div className="mb-3 rounded-lg bg-amber-50 px-4 py-2.5 text-xs text-amber-700">
        <strong>Penyesuaian Stok:</strong> Gunakan fitur ini untuk mencatat
        koreksi stok — barang rusak/hilang (<strong>Kurang</strong>) atau
        koreksi hitung fisik yang lebih (<strong>Tambah</strong>). Hanya angka
        stok yang berubah; saldo kas/omset tidak terpengaruh.
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-slate-800">Daftar Barang</h3>
        <Button size="sm" onClick={() => p.setPickerOpen(true)}>
          + Add Item
        </Button>
      </div>

      {p.items.length === 0 ? (
        <EmptyState
          title="Belum ada barang"
          description="Klik 'Add Item' untuk memilih barang yang akan disesuaikan"
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-2">Barang</th>
                <th className="py-2 pr-2 text-right">Stok Saat Ini</th>
                <th className="py-2 pr-2 text-right">Harga Beli</th>
                <th className="py-2 pr-2">Arah</th>
                <th className="py-2 pr-2 text-right">Qty</th>
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
                  <td className="py-2 pr-2">
                    <select
                      value={it.arah}
                      onChange={(e) => p.setArah(idx, e.target.value)}
                      className="rounded border border-slate-300 px-2 py-1 text-sm"
                    >
                      <option value="kurang">Kurang</option>
                      <option value="tambah">Tambah</option>
                    </select>
                  </td>
                  <td className="py-2 pr-2 text-right">
                    <input
                      type="number"
                      min={1}
                      max={it.arah === "kurang" ? it.stok : undefined}
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
        <Textarea
          label={
            <>
              Alasan Penyesuaian <span className="text-red-500">*</span>
            </>
          }
          value={p.alasan}
          onChange={(e) => p.setAlasan(e.target.value)}
          placeholder="Contoh: Barang pecah tersenggol, selisih hitung stok opname, koreksi input sebelumnya..."
          rows={2}
        />
        <Input
          label="Catatan (opsional)"
          value={p.catatan}
          onChange={(e) => p.setCatatan(e.target.value)}
          placeholder="Catatan tambahan..."
        />
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {p.items.length} barang
          {p.totalKurang > 0 && (
            <> · <span className="font-medium text-red-600">−{angka(p.totalKurang)} kurang</span></>
          )}
          {p.totalTambah > 0 && (
            <> · <span className="font-medium text-emerald-600">+{angka(p.totalTambah)} tambah</span></>
          )}
        </p>
        <Button
          onClick={() => p.setConfirm(true)}
          disabled={p.items.length === 0 || !p.alasan.trim() || p.submitting}
          variant="danger"
          loading={p.submitting}
        >
          Confirm Adjustment
        </Button>
      </div>

      <ConfirmDialog
        open={p.confirm}
        onClose={() => p.setConfirm(false)}
        onConfirm={p.handleSubmit}
        title="Konfirmasi Penyesuaian Stok"
        message={confirmMsg}
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
