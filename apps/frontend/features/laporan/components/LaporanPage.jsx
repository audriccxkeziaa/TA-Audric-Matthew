"use client";
// /laporan — Laporan Penjualan & Pembelian (admin). Orkestrator UI.

import { PageShell, PageHeader, Card, Button, Input, Select } from "@/components/ui";
import { tanggal } from "@/lib/format";
import { useLaporan } from "../hooks/useLaporan";
import { LaporanSummary } from "./LaporanSummary";
import { LaporanTable } from "./LaporanTable";
import { LaporanDetailModal } from "./LaporanDetailModal";

export default function LaporanPage() {
  const l = useLaporan();

  return (
    <PageShell>
      <PageHeader
        title="Laporan"
        description="Berisi rekap transaksi penjualan dan pembelian spareparts."
        actions={
          <div className="flex gap-2 no-print">
            <Button variant="outline" onClick={l.exportCsv}>
              Export CSV
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              Print PDF
            </Button>
          </div>
        }
      />

      {/* Tab — kasir hanya lihat penjualan */}
      <div className="mb-3 flex shrink-0 gap-1 no-print">
        <button
          onClick={() => l.changeTab("penjualan")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            l.isSales
              ? "bg-brand-600 text-white shadow-sm"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          Transaction (Stock Out)
        </button>
        {!l.isKasir && (
          <button
            onClick={() => l.changeTab("pembelian")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              !l.isSales
                ? "bg-brand-600 text-white shadow-sm"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            Purchase (Stock In)
          </button>
        )}
      </div>

      {/* Filter tanggal + kasir */}
      <Card className="mb-3 shrink-0 p-3 no-print">
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <Input
            label="Dari Tanggal"
            type="date"
            value={l.from}
            onChange={(e) => l.setFrom(e.target.value)}
          />
          <Input
            label="Sampai Tanggal"
            type="date"
            value={l.to}
            onChange={(e) => l.setTo(e.target.value)}
          />
          <Select
            label={l.isSales ? "Kasir" : "Input Oleh"}
            value={l.kasirFilter}
            onChange={(e) => {
              l.setKasirFilter(e.target.value);
              l.setPage(1);
            }}
          >
            <option value="">Semua {l.isSales ? "Kasir" : "User"}</option>
            {l.kasirOptions.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </Select>
          <div className="flex items-end">
            <button
              onClick={l.resetFilter}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              Reset Filter
            </button>
          </div>
        </div>
      </Card>

      {/* Judul cetak */}
      <div className="mb-3 hidden shrink-0 print:block">
        <h2 className="text-lg font-bold">
          Laporan {l.isSales ? "Penjualan" : "Pembelian"} — CV Asia Jaya Maju
        </h2>
        <p className="text-sm">
          Periode {tanggal(l.from)} s/d {tanggal(l.to)}
        </p>
      </div>

      <LaporanSummary isSales={l.isSales} summary={l.summary} isKasir={l.isKasir} />

      <LaporanTable
        isSales={l.isSales}
        isKasir={l.isKasir}
        isLoading={l.isLoading}
        isEmpty={l.filteredGrouped.length === 0}
        rows={l.paginatedGrouped}
        page={l.page}
        pageSize={l.pageSize}
        onRowClick={l.setDetailData}
      />

      {/* Pagination */}
      {l.filteredGrouped.length > l.pageSize && (
        <div className="mt-2 flex shrink-0 items-center justify-between text-sm text-slate-500 no-print">
          <span>
            {l.filteredGrouped.length} rows · pages {l.page}/{l.totalPages}
            {l.kasirFilter && ` · filter: ${l.kasirFilter}`}
          </span>
          <div className="flex gap-1">
            <button
              disabled={l.page <= 1}
              onClick={() => l.setPage((p) => p - 1)}
              className="rounded border border-slate-200 px-3 py-1 text-xs hover:bg-slate-50 disabled:opacity-40"
            >
              ← Previous
            </button>
            <button
              disabled={l.page >= l.totalPages}
              onClick={() => l.setPage((p) => p + 1)}
              className="rounded border border-slate-200 px-3 py-1 text-xs hover:bg-slate-50 disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      <LaporanDetailModal
        detailData={l.detailData}
        isSales={l.isSales}
        onClose={() => l.setDetailData(null)}
      />
    </PageShell>
  );
}
