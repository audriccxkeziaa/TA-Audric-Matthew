"use client";
// Tab "Retur ke Supplier" — 2 tahap:
// Tahap 1 (Kirim Retur): stok berkurang, dokumen status "Menunggu Barang Ganti"
// Tahap 2 (Barang Ganti Datang): "Selesaikan Retur" → stok bertambah kembali

import { Card, Button, Badge, Input, Textarea, ConfirmDialog, Spinner } from "@/components/ui";
import { rupiah, angka, tanggalJam } from "@/lib/format";
import { useReturSupplier } from "../hooks/useReturSupplier";

export function ReturSupplierForm() {
  const r = useReturSupplier();

  return (
    <>
      {/* ===== Seksi: Menunggu Barang Ganti (Tahap 2) ===== */}
      {r.pendingReturns.length > 0 && (
        <Card className="p-5 mb-4">
          <div className="mb-3 flex items-center gap-2">
            <h3 className="font-semibold text-slate-800">Menunggu Barang Ganti</h3>
            <Badge tone="amber">{r.pendingReturns.length}</Badge>
          </div>
          <p className="mb-3 text-xs text-slate-500">
            Retur berikut sudah dikirim ke supplier. Klik{" "}
            <strong>Selesaikan Retur</strong> saat barang pengganti sudah tiba di gudang.
          </p>
          <div className="space-y-2">
            {r.pendingWithItems.map((ret) => (
              <div
                key={ret.id}
                className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm font-medium text-slate-800">
                    {ret.kode_adjustment}
                  </p>
                  {ret.no_nota_ref && (
                    <p className="mt-0.5 text-xs text-slate-500">
                      Nota: <span className="font-medium text-slate-700">{ret.no_nota_ref}</span>
                    </p>
                  )}
                  <p className="mt-0.5 text-xs text-slate-500">
                    {tanggalJam(ret.created_at)} · {angka(ret.total_qty)} unit total
                  </p>
                  {ret.items.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5">
                      {ret.items.map((it) => (
                        <li key={it.id} className="flex items-center gap-1.5 text-xs text-slate-700">
                          <span className="h-1 w-1 shrink-0 rounded-full bg-amber-500" />
                          <span className="font-medium">{it.nama_barang}</span>
                          <span className="text-slate-400">({angka(it.qty)} unit)</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-1 max-w-sm truncate text-xs text-slate-400 italic">
                    {ret.alasan}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="success"
                  onClick={() => r.initiateResolve(ret)}
                  disabled={r.resolveSubmitting}
                >
                  Complete Return
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ===== Seksi: Form Buat Retur Baru (Tahap 1) ===== */}
      {!r.selected ? (
        <Card className="p-5">
          <h3 className="mb-3 font-semibold text-slate-800">
            Pilih Nota Pembelian Supplier
          </h3>
          <div className="mb-3 rounded-lg bg-blue-50 px-4 py-2.5 text-xs text-blue-700">
            <strong>Alur 2 Tahap:</strong> Tahap 1 — pilih nota &amp; item, simpan retur
            (stok langsung berkurang). Tahap 2 — saat barang ganti tiba, klik{" "}
            <strong>Selesaikan Retur</strong> di atas (stok bertambah kembali).
          </div>
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
              <p className="py-4 text-center text-sm text-slate-400">
                Tidak ada nota ditemukan
              </p>
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
      ) : (
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
            <Textarea
              label={
                <>
                  Alasan Retur <span className="text-red-500">*</span>
                </>
              }
              value={r.alasan}
              onChange={(e) => r.setAlasan(e.target.value)}
              placeholder="Contoh: Barang tidak sesuai tipe, jumlah kurang dari nota..."
              rows={2}
            />
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
              loading={r.submitting}
            >
              Confirm Return
            </Button>
          </div>

          <ConfirmDialog
            open={r.confirm}
            onClose={() => r.setConfirm(false)}
            onConfirm={r.handleSubmit}
            title="Konfirmasi Kirim Retur Supplier"
            message={`Stok ${r.checkedItems.length} barang akan BERKURANG (barang dikirim ke supplier). Dokumen akan berstatus "Menunggu Barang Ganti" hingga Tahap 2 diselesaikan. Lanjutkan?`}
            tone="danger"
          />
        </Card>
      )}

      {/* Dialog Tahap 2: konfirmasi barang ganti diterima */}
      <ConfirmDialog
        open={!!r.resolveId}
        onClose={() => { r.setResolveId(null); }}
        onConfirm={r.handleResolve}
        title="Konfirmasi Barang Ganti Diterima"
        message="Pastikan barang pengganti dari supplier sudah masuk ke gudang. Stok akan bertambah sesuai jumlah retur semula. Lanjutkan?"
        confirmLabel="Ya, Barang Sudah Diterima"
        tone="success"
      />
    </>
  );
}
