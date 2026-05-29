"use client";
// Tab "Retur Pelanggan" — cari transaksi, set item + kondisi, submit. Bila
// dibuat kasir → menunggu persetujuan admin (PIN on-site / remote).

import { Card, Button, Input, Badge, ConfirmDialog, Spinner } from "@/components/ui";
import { rupiah, angka, tanggalJam } from "@/lib/format";
import { useReturPelanggan } from "../hooks/useReturPelanggan";

export function ReturPelangganForm() {
  const r = useReturPelanggan();

  if (!r.selected && !r.overrideData) {
    return (
      <Card className="p-5">
        <h3 className="mb-3 font-semibold text-slate-800">
          Cari Transaksi Penjualan
        </h3>

        {r.user?.role === "kasir" && (
          <div className="mb-3 rounded-lg bg-blue-50 px-4 py-2.5 text-xs text-blue-700">
            <strong>Info:</strong> Retur pelanggan membutuhkan persetujuan admin.
            Setelah submit, admin bisa menyetujui via PIN langsung di layar ini
            atau dari Dashboard Admin.
          </div>
        )}

        <div className="flex gap-2">
          <input
            placeholder="Cari kode transaksi..."
            value={r.kodeQ}
            onChange={(e) => r.setKodeQ(e.target.value)}
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
              Tidak ada transaksi ditemukan
            </p>
          )}
          {!r.loading &&
            r.filtered.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => r.selectSale(s)}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-4 py-3 text-left hover:border-brand-400 hover:bg-brand-50"
              >
                <div>
                  <p className="text-sm font-medium text-slate-800">{s.kode_transaksi}</p>
                  <p className="text-xs text-slate-400">
                    {tanggalJam(s.created_at)} · {s.items?.length || 0} item
                  </p>
                </div>
                <p className="text-sm font-semibold text-slate-700">{rupiah(s.total_harga)}</p>
              </button>
            ))}
        </div>
      </Card>
    );
  }

  // Manager Override (Opsi A on-site + Opsi B remote waiting)
  if (r.overrideData) {
    return (
      <Card className="p-5">
        <div className="mx-auto max-w-md text-center">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          </div>

          <h3 className="mb-1 text-lg font-semibold text-slate-800">
            Menunggu Persetujuan Admin
          </h3>
          <p className="mb-1 text-sm text-slate-500">
            Retur <span className="font-mono font-medium">{r.overrideData.kode}</span> telah
            dibuat dan sedang menunggu persetujuan.
          </p>
          <p className="mb-6 text-xs text-slate-400">
            Notifikasi sudah terkirim ke Dashboard Admin secara real-time.
          </p>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-left">
            <h4 className="mb-3 text-sm font-semibold text-slate-700">
              Opsi A: Admin di Toko (Input Password)
            </h4>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Username Admin
                </label>
                <input
                  type="text"
                  value={r.pinUsername}
                  onChange={(e) => r.setPinUsername(e.target.value)}
                  placeholder="Username admin..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Password Admin
                </label>
                <input
                  type="password"
                  value={r.pinPassword}
                  onChange={(e) => r.setPinPassword(e.target.value)}
                  placeholder="Password admin..."
                  onKeyDown={(e) => e.key === "Enter" && r.handlePinApprove()}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                  autoComplete="off"
                />
              </div>
              {r.pinError && (
                <p className="text-xs font-medium text-red-600">{r.pinError}</p>
              )}
              <Button onClick={r.handlePinApprove} disabled={r.pinSubmitting} className="w-full">
                {r.pinSubmitting ? "Memverifikasi..." : "Verifikasi & Setujui"}
              </Button>
            </div>

            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-xs text-slate-400">atau</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <div className="text-center">
              <h4 className="mb-2 text-sm font-semibold text-slate-700">
                Opsi B: Admin di Luar (Remote)
              </h4>
              <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-400" />
                Menunggu persetujuan remote dari admin...
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Halaman ini akan otomatis terupdate saat admin menyetujui.
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              r.setOverrideData(null);
              r.resetForm();
            }}
            className="mt-4 text-xs text-slate-400 hover:text-slate-600"
          >
            Tutup (retur tetap pending dan bisa disetujui nanti dari Dashboard Admin)
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-800">
            Retur Transaksi: {r.selected.kode_transaksi}
          </h3>
          <p className="text-xs text-slate-400">{tanggalJam(r.selected.created_at)}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => r.setSelected(null)}>
          Ganti Transaksi
        </Button>
      </div>

      <div className="mb-3 rounded-lg bg-blue-50 px-4 py-2.5 text-xs text-blue-700">
        <strong>Info:</strong> Kondisi &ldquo;Bagus&rdquo; = stok kembali bertambah.
        Kondisi &ldquo;Rusak&rdquo; = stok <strong>tidak</strong> bertambah (dicatat
        sebagai barang reject).
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-2">Pilih</th>
              <th className="py-2 pr-2">Barang</th>
              <th className="py-2 pr-2 text-right">Qty Beli</th>
              <th className="py-2 pr-2 text-right">Harga</th>
              <th className="py-2 pr-2 text-right">Qty Retur</th>
              <th className="py-2">Kondisi</th>
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
                <td className="py-2 pr-2 text-right">{rupiah(it.harga_satuan)}</td>
                <td className="py-2 pr-2 text-right">
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
                <td className="py-2">
                  {it.checked ? (
                    <select
                      value={it.kondisi}
                      onChange={(e) => r.setKondisi(idx, e.target.value)}
                      className="rounded border border-slate-300 px-2 py-1 text-sm"
                    >
                      <option value="bagus">Bagus</option>
                      <option value="rusak">Rusak</option>
                    </select>
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
            placeholder="Contoh: Pelanggan mengembalikan karena salah ukuran..."
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
        <div className="text-sm text-slate-500">
          <p>
            {r.checkedItems.length} item dipilih
            {r.goodCount > 0 && (
              <>{" "}<Badge tone="green">{r.goodCount} bagus (stok +)</Badge></>
            )}{" "}
            {r.badCount > 0 && (
              <Badge tone="red">{r.badCount} rusak (stok tetap)</Badge>
            )}
          </p>
        </div>
        <Button
          onClick={() => r.setConfirm(true)}
          disabled={r.checkedItems.length === 0 || !r.alasan.trim() || r.submitting}
          variant="primary"
        >
          {r.submitting ? "Loading..." : "Konfirmasi Retur"}
        </Button>
      </div>

      <ConfirmDialog
        open={r.confirm}
        onClose={() => r.setConfirm(false)}
        onConfirm={r.handleSubmit}
        title="Konfirmasi Retur Pelanggan"
        message={
          r.user?.role === "kasir"
            ? `${r.goodCount} barang kondisi bagus, ${r.badCount} barang kondisi rusak. Retur akan menunggu persetujuan admin. Lanjutkan?`
            : `${r.goodCount} barang kondisi bagus (stok bertambah), ${r.badCount} barang kondisi rusak (stok tidak bertambah). Lanjutkan?`
        }
      />
    </Card>
  );
}
