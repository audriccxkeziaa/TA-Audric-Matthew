"use client";
// PrintPreviewModal — dialog preview dokumen cetak laporan.
// Klik "Cetak Sekarang" → window.print() → @media print CSS menampilkan
// hanya div.print-document, menyembunyikan seluruh halaman lainnya.

import { Printer, X } from "lucide-react";
import { Button } from "@/components/ui";
import { rupiah, angka, tanggal } from "@/lib/format";
import { JENIS_LABELS } from "@/features/keuangan/lib/constants";

const TAB_NAMES = {
  keuangan: "Ringkasan & Arus Kas",
  transaksi: "Riwayat Transaksi Penjualan",
  stok: "Kondisi Persediaan & Stok",
};

function fmtNow() {
  return new Date().toLocaleString("id-ID", {
    timeZone: "Asia/Makassar",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Konten dokumen per tab ──

function KeuanganDoc({ fs, unifiedRows }) {
  const totalPengeluaran = (fs?.total_pembelian || 0) + (fs?.total_pengeluaran || 0);
  return (
    <>
      {/* Summary boxes */}
      <div className="mb-5 grid grid-cols-3 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="text-center">
          <p className="text-[10px] uppercase text-slate-500">Pendapatan Kotor</p>
          <p className="mt-1 text-sm font-bold text-emerald-700">{rupiah(fs?.omset_kotor || 0)}</p>
          <p className="text-[9px] text-slate-400">{angka(fs?.n_sales || 0)} transaksi</p>
        </div>
        <div className="border-x border-slate-200 text-center">
          <p className="text-[10px] uppercase text-slate-500">Total Pengeluaran</p>
          <p className="mt-1 text-sm font-bold text-red-700">{rupiah(totalPengeluaran)}</p>
          <p className="text-[9px] text-slate-400">Supplier + Operasional</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] uppercase text-slate-500">Pendapatan Bersih</p>
          <p className={`mt-1 text-sm font-bold ${(fs?.saldo_bersih || 0) >= 0 ? "text-brand-700" : "text-red-700"}`}>
            {rupiah(fs?.saldo_bersih || 0)}
          </p>
          <p className="text-[9px] text-slate-400">{(fs?.saldo_bersih || 0) >= 0 ? "Surplus" : "Defisit"}</p>
        </div>
      </div>

      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        Daftar Pengeluaran ({unifiedRows.length} entri)
      </p>
      <table className="w-full border-collapse text-[10px]">
        <thead>
          <tr className="bg-slate-100">
            <th className="border border-slate-200 px-2 py-1.5 text-left">Tanggal</th>
            <th className="border border-slate-200 px-2 py-1.5 text-left">Jenis</th>
            <th className="border border-slate-200 px-2 py-1.5 text-left">Deskripsi</th>
            <th className="border border-slate-200 px-2 py-1.5 text-right">Nominal</th>
          </tr>
        </thead>
        <tbody>
          {unifiedRows.slice(0, 25).map((r) => (
            <tr key={r.id}>
              <td className="border border-slate-200 px-2 py-1">{tanggal(r.tanggal)}</td>
              <td className="border border-slate-200 px-2 py-1">{JENIS_LABELS[r.jenis] || r.jenis}</td>
              <td className="border border-slate-200 px-2 py-1">{r.deskripsi}</td>
              <td className="border border-slate-200 px-2 py-1 text-right font-medium text-red-700">
                − {rupiah(r.nominal)}
              </td>
            </tr>
          ))}
          {unifiedRows.length > 25 && (
            <tr>
              <td colSpan={4} className="border border-slate-200 px-2 py-1 text-center italic text-slate-400">
                ... dan {unifiedRows.length - 25} entri lainnya
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}

function TransaksiDoc({ summary, rows }) {
  return (
    <>
      <div className="mb-5 grid grid-cols-3 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="text-center">
          <p className="text-[10px] uppercase text-slate-500">Total Transaksi</p>
          <p className="mt-1 text-lg font-bold text-slate-800">{angka(summary.total_transactions || 0)}</p>
        </div>
        <div className="border-x border-slate-200 text-center">
          <p className="text-[10px] uppercase text-slate-500">Total Item Terjual</p>
          <p className="mt-1 text-lg font-bold text-slate-800">{angka(summary.total_qty || 0)}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] uppercase text-slate-500">Total Revenue</p>
          <p className="mt-1 text-sm font-bold text-emerald-700">{rupiah(summary.total_revenue || 0)}</p>
        </div>
      </div>

      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        Daftar Transaksi ({rows.length} transaksi)
      </p>
      <table className="w-full border-collapse text-[10px]">
        <thead>
          <tr className="bg-slate-100">
            <th className="border border-slate-200 px-2 py-1.5 text-left w-6">No</th>
            <th className="border border-slate-200 px-2 py-1.5 text-left">Tanggal</th>
            <th className="border border-slate-200 px-2 py-1.5 text-left">Kode Transaksi</th>
            <th className="border border-slate-200 px-2 py-1.5 text-left">Kasir</th>
            <th className="border border-slate-200 px-2 py-1.5 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 25).map((g, i) => (
            <tr key={g.sale_id}>
              <td className="border border-slate-200 px-2 py-1 text-slate-400">{i + 1}</td>
              <td className="border border-slate-200 px-2 py-1">{tanggal(g.created_at)}</td>
              <td className="border border-slate-200 px-2 py-1 font-mono">{g.kode_transaksi}</td>
              <td className="border border-slate-200 px-2 py-1">{g.kasir}</td>
              <td className="border border-slate-200 px-2 py-1 text-right font-semibold text-emerald-700">
                {rupiah(g.total)}
              </td>
            </tr>
          ))}
          {rows.length > 25 && (
            <tr>
              <td colSpan={5} className="border border-slate-200 px-2 py-1 text-center italic text-slate-400">
                ... dan {rows.length - 25} transaksi lainnya
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}

function StokDoc({ summary, rows }) {
  return (
    <>
      <div className="mb-5 grid grid-cols-4 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
        {[
          { label: "Total", val: summary.total, color: "text-slate-800" },
          { label: "Habis", val: summary.habis, color: "text-red-700" },
          { label: "Kritis", val: summary.kritis, color: "text-amber-700" },
          { label: "Menipis", val: summary.menipis, color: "text-slate-700" },
        ].map(({ label, val, color }, i) => (
          <div key={label} className={`text-center ${i > 0 ? "border-l border-slate-200" : ""}`}>
            <p className="text-[10px] uppercase text-slate-500">{label}</p>
            <p className={`mt-1 text-lg font-bold ${color}`}>{angka(val)}</p>
          </div>
        ))}
      </div>

      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        Daftar Produk Perlu Restock ({rows.length} item)
      </p>
      <table className="w-full border-collapse text-[10px]">
        <thead>
          <tr className="bg-slate-100">
            <th className="border border-slate-200 px-2 py-1.5 text-left w-6">No</th>
            <th className="border border-slate-200 px-2 py-1.5 text-left">Kode Barang</th>
            <th className="border border-slate-200 px-2 py-1.5 text-left">Nama Barang</th>
            <th className="border border-slate-200 px-2 py-1.5 text-right">Stok</th>
            <th className="border border-slate-200 px-2 py-1.5 text-right">Min</th>
            <th className="border border-slate-200 px-2 py-1.5 text-right">Perlu Beli</th>
            <th className="border border-slate-200 px-2 py-1.5 text-center">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 30).map((it, i) => (
            <tr key={it.id}>
              <td className="border border-slate-200 px-2 py-1 text-slate-400">{i + 1}</td>
              <td className="border border-slate-200 px-2 py-1 font-mono">{it.kode_barang}</td>
              <td className="border border-slate-200 px-2 py-1">{it.nama_barang}</td>
              <td className="border border-slate-200 px-2 py-1 text-right">{angka(it.stok)}</td>
              <td className="border border-slate-200 px-2 py-1 text-right">{angka(it.min_stock)}</td>
              <td className="border border-slate-200 px-2 py-1 text-right font-semibold">
                {angka(Math.max(0, it.min_stock - it.stok))}
              </td>
              <td className={`border border-slate-200 px-2 py-1 text-center font-semibold ${
                it.tingkat_urgensi === "HABIS"
                  ? "text-red-600"
                  : it.tingkat_urgensi === "KRITIS"
                  ? "text-amber-600"
                  : "text-slate-600"
              }`}>
                {it.tingkat_urgensi}
              </td>
            </tr>
          ))}
          {rows.length > 30 && (
            <tr>
              <td colSpan={7} className="border border-slate-200 px-2 py-1 text-center italic text-slate-400">
                ... dan {rows.length - 30} item lainnya
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}

// ── Modal utama ──
export function PrintPreviewModal({
  open,
  onClose,
  activeTab,
  from,
  to,
  fs,
  unifiedRows,
  salesSummary,
  filteredSales,
  restockSummary,
  restockItems,
}) {
  if (!open) return null;

  const tabTitle = TAB_NAMES[activeTab] || activeTab;
  const printedAt = fmtNow();
  const totalPengeluaran = (fs?.total_pembelian || 0) + (fs?.total_pengeluaran || 0);

  return (
    // Outer wrapper: no-print — seluruh overlay disembunyikan saat cetak
    <div className="no-print fixed inset-0 z-50 flex items-stretch bg-slate-900/70 backdrop-blur-sm">

      {/* ════ Panel kiri: info & aksi ════ */}
      <div className="flex w-72 shrink-0 flex-col gap-5 overflow-y-auto bg-slate-800 p-6 text-white">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Cetak Laporan</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 transition hover:bg-white/10"
            aria-label="Tutup"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 text-sm">
          <div className="rounded-lg bg-white/10 p-3">
            <p className="mb-0.5 text-[10px] uppercase text-white/50">Jenis Laporan</p>
            <p className="font-semibold">{tabTitle}</p>
          </div>
          <div className="rounded-lg bg-white/10 p-3">
            <p className="mb-0.5 text-[10px] uppercase text-white/50">Periode</p>
            <p className="font-semibold">{tanggal(from)} s/d {tanggal(to)}</p>
          </div>
        </div>

        {/* Ringkasan numerik per tab */}
        {activeTab === "keuangan" && fs && (
          <div className="space-y-2 text-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-white/50">Ringkasan Kas</p>
            {[
              { label: "Pendapatan Kotor", val: fs.omset_kotor || 0, cls: "text-emerald-300" },
              { label: "Total Pengeluaran", val: totalPengeluaran, cls: "text-red-300" },
              { label: "Pendapatan Bersih", val: fs.saldo_bersih || 0, cls: (fs.saldo_bersih || 0) >= 0 ? "text-brand-300" : "text-red-300" },
            ].map(({ label, val, cls }) => (
              <div key={label} className="flex items-center justify-between rounded-lg bg-white/10 px-3 py-2">
                <span className="text-xs text-white/60">{label}</span>
                <span className={`font-bold ${cls}`}>{rupiah(val)}</span>
              </div>
            ))}
          </div>
        )}

        {activeTab === "transaksi" && (
          <div className="space-y-2 text-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-white/50">Ringkasan</p>
            <div className="rounded-lg bg-white/10 px-3 py-2 flex justify-between">
              <span className="text-xs text-white/60">Transaksi</span>
              <span className="font-bold">{angka(salesSummary.total_transactions || 0)}</span>
            </div>
            <div className="rounded-lg bg-white/10 px-3 py-2 flex justify-between">
              <span className="text-xs text-white/60">Revenue</span>
              <span className="font-bold text-emerald-300">{rupiah(salesSummary.total_revenue || 0)}</span>
            </div>
          </div>
        )}

        {activeTab === "stok" && (
          <div className="space-y-2 text-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-white/50">Kondisi Stok</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Habis", val: restockSummary.habis, cls: "text-red-400" },
                { label: "Kritis", val: restockSummary.kritis, cls: "text-amber-400" },
                { label: "Menipis", val: restockSummary.menipis, cls: "text-white" },
                { label: "Total", val: restockSummary.total, cls: "text-white" },
              ].map(({ label, val, cls }) => (
                <div key={label} className="rounded-lg bg-white/10 p-2.5 text-center">
                  <p className={`text-lg font-bold ${cls}`}>{angka(val)}</p>
                  <p className="text-[10px] text-white/50">{label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-auto space-y-2">
          <Button className="w-full" onClick={() => window.print()}>
            <Printer size={16} />
            Cetak Sekarang
          </Button>
          <Button variant="secondary" className="w-full" onClick={onClose}>
            Batal
          </Button>
        </div>
      </div>

      {/* ════ Panel kanan: preview dokumen ════ */}
      <div className="flex-1 overflow-y-auto bg-slate-600 p-6">
        <div className="mx-auto max-w-[794px]">

          {/* print-document: DIV INI yang dicetak oleh @media print */}
          <div className="print-document min-h-[1123px] rounded-lg bg-white p-8 shadow-2xl text-slate-900">

            {/* Kop surat */}
            <div className="mb-5 border-b-2 border-slate-800 pb-4 text-center">
              <p className="text-xl font-bold tracking-tight">CV ASIA JAYA MAJU</p>
              <p className="text-xs text-slate-500">Suku Cadang Sepeda Motor</p>
              <p className="text-xs text-slate-500">
                Jl. A. Yani KM 34 No. 56, Loktabat Selatan, Banjarbaru, Kalimantan Selatan 70714
              </p>
              <p className="text-xs text-slate-500">Telp: 0851-0262-6289</p>
            </div>

            {/* Judul laporan */}
            <div className="mb-6 text-center">
              <p className="text-sm font-bold uppercase tracking-wide text-slate-800">
                LAPORAN {tabTitle.toUpperCase()}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                Periode: {tanggal(from)} s/d {tanggal(to)}
              </p>
            </div>

            {/* Konten berdasarkan tab */}
            {activeTab === "keuangan" && (
              <KeuanganDoc fs={fs} unifiedRows={unifiedRows} />
            )}
            {activeTab === "transaksi" && (
              <TransaksiDoc summary={salesSummary} rows={filteredSales} />
            )}
            {activeTab === "stok" && (
              <StokDoc summary={restockSummary} rows={restockItems} />
            )}

            {/* Footer */}
            <div className="mt-8 flex justify-between border-t border-slate-200 pt-4 text-[10px] text-slate-400">
              <span>Dicetak: {printedAt} WITA</span>
              <div className="text-right">
                <p>Mengetahui,</p>
                <div className="mt-10 border-t border-slate-400 pt-1">
                  <p className="font-medium text-slate-600">Pimpinan</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
