"use client";
// Modal detail transaksi dual-panel:
//   Kiri  — info ringkasan + tabel item
//   Kanan — preview struk thermal (hanya tab penjualan) + tombol Cetak Struk

import { Modal, Button } from "@/components/ui";
import { rupiah, angka } from "@/lib/format";
import { printReceipt } from "@/lib/receipt";

// Tanggal+jam WITA eksplisit — seragam dengan struk fisik yang dicetak
function fmtWita(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("id-ID", {
    timeZone: "Asia/Makassar",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function DashLine() {
  return <div className="my-2 border-t border-dashed border-slate-300" />;
}

// Komponen preview struk thermal — React mirror dari template HTML di lib/receipt.js
// agar tampilan di modal 100% seragam dengan struk yang dicetak ke printer.
function ReceiptPreview({ data }) {
  return (
    <div className="rounded border border-slate-200 bg-white p-3 font-mono text-[10px] leading-snug text-slate-900 shadow-inner">
      {/* Header toko */}
      <div className="mb-2 text-center">
        <div className="text-[12px] font-bold">CV ASIA JAYA MAJU</div>
        <div className="text-[9px] text-slate-500">Suku Cadang Sepeda Motor</div>
        <div className="text-[7.5px] text-slate-400">Jl. A. Yani KM 34 No. 56, Loktabat Selatan</div>
        <div className="text-[7.5px] text-slate-400">Banjarbaru, Kalsel 70714</div>
        <div className="text-[7.5px] text-slate-400">No. Telp: 0851-0262-6289</div>
      </div>

      <DashLine />

      {/* Meta transaksi */}
      <div className="space-y-0.5 text-[9.5px]">
        <div className="flex gap-1">
          <span className="w-14 shrink-0 text-slate-400">Transaksi</span>
          <span className="break-all">: {data.kode_transaksi}</span>
        </div>
        <div className="flex gap-1">
          <span className="w-14 shrink-0 text-slate-400">Tanggal</span>
          <span>: {fmtWita(data.created_at)}</span>
        </div>
        {data.kasir && (
          <div className="flex gap-1">
            <span className="w-14 shrink-0 text-slate-400">Kasir</span>
            <span>: {data.kasir}</span>
          </div>
        )}
      </div>

      <DashLine />

      {/* Item-item */}
      <div className="space-y-2">
        {(data.items || []).map((it, idx) => (
          <div key={idx}>
            <div className="truncate text-[10px] font-semibold">{it.nama_barang}</div>
            <div className="flex justify-between text-[9px] text-slate-500">
              <span>
                {it.qty} × {rupiah(it.harga_satuan)}
              </span>
              <span className="font-medium text-slate-800">{rupiah(it.subtotal)}</span>
            </div>
          </div>
        ))}
      </div>

      <DashLine />

      {/* Grand total */}
      <div className="flex justify-between text-[11px] font-bold">
        <span>TOTAL</span>
        <span>{rupiah(data.total)}</span>
      </div>

      <DashLine />

      {/* Footer */}
      <div className="mt-1 text-center text-[8.5px] text-slate-400">
        Terima kasih atas kunjungan Anda
      </div>
    </div>
  );
}

export function LaporanDetailModal({ detailData, isSales, returMap, onClose }) {
  if (!detailData) return null;

  return (
    <Modal
      open={Boolean(detailData)}
      onClose={onClose}
      title={
        isSales
          ? `Transaksi ${detailData.kode_transaksi}`
          : `Nota ${detailData.no_nota || "(tanpa nomor)"}`
      }
      width="max-w-5xl"
    >
      <div className="flex gap-6">
        {/* ════════════════ PANEL KIRI: Detail & Items ════════════════ */}
        <div className="flex w-1/2 min-w-0 flex-col gap-4">

          {/* Info ringkasan */}
          <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 px-4 py-3 text-sm">
            <div>
              <span className="text-xs text-slate-400">Tanggal (WITA)</span>
              <p className="font-medium">{fmtWita(detailData.created_at)}</p>
            </div>
            <div>
              <span className="text-xs text-slate-400">
                {isSales ? "Kasir" : "Diinput Oleh"}
              </span>
              <p className="font-medium">
                {isSales ? detailData.kasir : detailData.user}
              </p>
            </div>
            <div>
              <span className="text-xs text-slate-400">Jumlah Item</span>
              <p className="font-medium">{detailData.item_count} item</p>
            </div>
            <div>
              <span className="text-xs text-slate-400">Total Qty</span>
              <p className="font-medium">{angka(detailData.total_qty)} unit</p>
            </div>
            {!isSales && detailData.status_validasi && (
              <div className="col-span-2">
                <span className="text-xs text-slate-400">Status</span>
                <p className="font-medium capitalize">{detailData.status_validasi}</p>
              </div>
            )}
          </div>

          {/* Tabel item (scrollable) */}
          <div className="max-h-60 overflow-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase text-slate-500">
                {isSales ? (
                  <tr>
                    <th className="px-3 py-2">No</th>
                    <th className="px-3 py-2">Barang</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-right">Harga</th>
                    <th className="px-3 py-2 text-right">Diskon</th>
                    <th className="px-3 py-2 text-right">Subtotal</th>
                  </tr>
                ) : (
                  <tr>
                    <th className="px-3 py-2">No</th>
                    <th className="px-3 py-2">Barang</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-right">Harga Beli</th>
                    <th className="px-3 py-2 text-right">Subtotal</th>
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-slate-100">
                {detailData.items.map((it, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="px-3 py-2 text-xs text-slate-400">{idx + 1}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium">{it.nama_barang}</span>
                        {isSales && returMap?.get(it.product_id) > 0 && (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                            Retur {returMap.get(it.product_id)} unit
                          </span>
                        )}
                      </div>
                      <span className="block font-mono text-xs text-slate-400">
                        {it.kode_barang}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{it.qty}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {rupiah(isSales ? it.harga_satuan : it.harga_beli)}
                    </td>
                    {isSales && (
                      <td className="px-3 py-2 text-right tabular-nums">
                        {Number(it.diskon_persen) > 0 ? (
                          <span className="font-medium text-rose-600">
                            {it.diskon_persen}%
                          </span>
                        ) : (
                          <span className="text-slate-300">0%</span>
                        )}
                      </td>
                    )}
                    <td className="px-3 py-2 text-right font-medium tabular-nums">
                      {rupiah(it.subtotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer total */}
          <div className="rounded-lg bg-brand-50 px-4 py-3">
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>
                <span className="font-medium">{detailData.item_count}</span> item{" "}·{" "}
                <span className="font-medium">{angka(detailData.total_qty)}</span> qty
              </span>
              {!isSales && (
                <span>
                  Subtotal:{" "}
                  <span className="font-medium">
                    {rupiah(detailData.subtotal_before_diskon || detailData.total)}
                  </span>
                </span>
              )}
            </div>
            {!isSales && detailData.nota_diskon_persen > 0 && (
              <div className="mt-2 flex items-center justify-between border-t border-brand-100 pt-2 text-sm">
                <span className="text-slate-500">
                  Diskon ({detailData.nota_diskon_persen}%)
                </span>
                <span className="font-semibold text-rose-600">
                  −
                  {rupiah(
                    Math.round(
                      (detailData.subtotal_before_diskon * detailData.nota_diskon_persen) / 100
                    )
                  )}
                </span>
              </div>
            )}
            {!isSales && detailData.nota_potongan_harga > 0 && (
              <div
                className={`flex items-center justify-between text-sm ${
                  detailData.nota_diskon_persen > 0
                    ? "mt-1"
                    : "mt-2 border-t border-brand-100 pt-2"
                }`}
              >
                <span className="text-slate-500">Potongan Harga</span>
                <span className="font-semibold text-rose-600">
                  −{rupiah(detailData.nota_potongan_harga)}
                </span>
              </div>
            )}
            <div
              className={`flex items-center justify-between ${
                !isSales ? "mt-2 border-t border-brand-200 pt-2" : "mt-1"
              }`}
            >
              <span className="text-sm font-medium text-slate-700">Total</span>
              <p className="text-xl font-bold text-brand-700">{rupiah(detailData.total)}</p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>

        {/* ════════════════ PANEL KANAN: Preview Struk (hanya penjualan) ════════════════ */}
        {isSales && (
          <div className="flex w-1/2 flex-col gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Preview Struk
            </p>
            <div className="max-h-[420px] flex-1 overflow-y-auto">
              <ReceiptPreview data={detailData} />
            </div>
            <Button
              className="w-full"
              onClick={() =>
                printReceipt({ ...detailData, total_harga: detailData.total })
              }
            >
              🖨️ Print Receipt
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
