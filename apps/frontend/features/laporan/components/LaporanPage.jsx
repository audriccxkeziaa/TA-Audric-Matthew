"use client";
// /laporan — Laporan Terpadu (admin). 2 tab: Keuangan (split) + Transaksi.

import {
  PageShell, PageHeader, Card, StatCard, Badge,
  Button, Input, Select, Modal, Tabs, Spinner, EmptyState,
} from "@/components/ui";
import { rupiah, angka, tanggal } from "@/lib/format";
import {
  TrendingUp, TrendingDown, Package, Wallet, Printer, ReceiptText,
} from "lucide-react";
import { useLaporanTerpadu } from "../hooks/useLaporanTerpadu";
import { LaporanTable } from "./LaporanTable";
import { LaporanDetailModal } from "./LaporanDetailModal";
import { LaporanSummary } from "./LaporanSummary";
import { PurchaseDetailModal } from "@/features/keuangan/components/PurchaseDetailModal";
import { PrintPreviewModal } from "./PrintPreviewModal";
import { JENIS_LABELS, JENIS_BADGE_TONE, JENIS_OPTIONS } from "@/features/keuangan/lib/constants";

const TABS = [
  { id: "keuangan", label: "Ringkasan & Keuangan" },
  { id: "transaksi", label: "Riwayat Transaksi Penjualan" },
];

const PERIOD_PRESETS = [
  { id: "bulan-ini",  label: "Bulan Ini" },
  { id: "bulan-lalu", label: "Bulan Lalu" },
  { id: "3-bulan",    label: "3 Bulan" },
  { id: "tahun-ini",  label: "Tahun Ini" },
  { id: "custom",     label: "Custom" },
];

export default function LaporanPage() {
  const l = useLaporanTerpadu();
  const fs = l.fs;
  const totalPengeluaran = (fs?.total_pembelian || 0) + (fs?.total_pengeluaran || 0);

  return (
    <PageShell>
      <PageHeader
        title="Laporan Terpadu"
        description="Ringkasan keuangan dan riwayat transaksi penjualan."
        actions={
          <div className="flex gap-2 no-print">
            <Button variant="secondary" onClick={l.exportCsv}>Export CSV</Button>
            <Button onClick={() => l.setPrintOpen(true)}>
              <Printer size={16} /> Cetak Laporan
            </Button>
          </div>
        }
      />

      {/* ── Filter Periode ── */}
      <Card className="mb-3 shrink-0 p-3 no-print">
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Periode:</span>
            {PERIOD_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => l.applyPreset(p.id)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  l.periodPreset === p.id
                    ? "bg-brand-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {p.label}
              </button>
            ))}
            <Button size="sm" variant="secondary" onClick={l.resetFilter}>Reset</Button>
          </div>

          {l.periodPreset === "custom" && (
            <div className="grid gap-3 sm:grid-cols-2">
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
            </div>
          )}
        </div>
      </Card>

      {/* ── Card utama: Tabs + konten ── */}
      <Card className="flex min-h-0 flex-1 flex-col p-0">
        <Tabs tabs={TABS} activeTab={l.activeTab} onTabChange={l.setActiveTab} className="px-4 pt-1 no-print" />

        <div className="flex min-h-0 flex-1 flex-col">

          {/* ════════════════════════════════════════
              Tab 1 — Ringkasan & Keuangan
          ════════════════════════════════════════ */}
          {l.activeTab === "keuangan" && (
            <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">

              {/* 5 Summary cards */}
              {l.financeSummary.isLoading ? (
                <div className="shrink-0 p-4"><Spinner label="Menghitung saldo..." /></div>
              ) : (
                <div className="grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                  <StatCard
                    label="Pendapatan Kotor"
                    value={rupiah(fs?.omset_kotor || 0)}
                    tone="good"
                    hint={`${angka(fs?.n_sales || 0)} transaksi`}
                    icon={<TrendingUp size={18} />}
                  />
                  <StatCard
                    label="Pembelian Supplier"
                    value={rupiah(fs?.total_pembelian || 0)}
                    tone="warn"
                    hint={`${angka(fs?.n_purchases || 0)} nota`}
                    icon={<Package size={18} />}
                  />
                  <StatCard
                    label="Pengeluaran Operasional"
                    value={rupiah(fs?.total_pengeluaran || 0)}
                    tone="bad"
                    hint={`${angka(fs?.n_expenses || 0)} entri`}
                    icon={<TrendingDown size={18} />}
                  />
                  <StatCard
                    label="Total Pengeluaran"
                    value={rupiah(totalPengeluaran)}
                    tone="bad"
                    hint="Supplier + Operasional"
                    icon={<ReceiptText size={18} />}
                  />
                  <StatCard
                    label="Pendapatan Bersih"
                    value={rupiah(fs?.saldo_bersih || 0)}
                    tone={fs?.saldo_bersih >= 0 ? "good" : "bad"}
                    hint="Pendapatan Kotor − Total Pengeluaran"
                    icon={<Wallet size={18} />}
                    accent
                  />
                </div>
              )}

              {/* Split panels */}
              <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">

                {/* ── Rincian Pemasukan ── */}
                <Card className="flex min-h-0 flex-1 flex-col p-0">
                  <div className="shrink-0 border-b border-slate-100 px-4 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Rincian Pemasukan
                        </h3>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {l.filteredSales.length} transaksi
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-emerald-600">
                          {rupiah(l.salesSummary?.total_revenue || 0)}
                        </span>
                        {/* Filter kasir inline */}
                        <select
                          value={l.kasirFilter}
                          onChange={(e) => l.setKasirFilter(e.target.value)}
                          className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600 focus:border-brand-400 focus:outline-none"
                        >
                          <option value="">Semua Kasir</option>
                          {l.kasirOptions.map((k) => (
                            <option key={k} value={k}>{k}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="min-h-0 flex-1 overflow-auto thin-scroll">
                    {l.salesQuery.isLoading ? (
                      <div className="p-4"><Spinner label="Memuat..." /></div>
                    ) : l.filteredSales.length === 0 ? (
                      <EmptyState title="Belum ada transaksi penjualan" />
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase text-slate-500">
                          <tr>
                            <th className="px-3 py-2">Tanggal</th>
                            <th className="px-3 py-2">Kode Transaksi</th>
                            <th className="px-3 py-2">Kasir</th>
                            <th className="px-3 py-2 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {l.filteredSales.map((g) => (
                            <tr
                              key={g.sale_id}
                              onClick={() => l.setDetailData(g)}
                              className="cursor-pointer transition-colors hover:bg-brand-50/40"
                            >
                              <td className="px-3 py-2 text-xs">{tanggal(g.created_at)}</td>
                              <td className="px-3 py-2 font-mono text-xs text-brand-700">{g.kode_transaksi}</td>
                              <td className="px-3 py-2 text-xs text-slate-500">{g.kasir}</td>
                              <td className="px-3 py-2 text-right font-semibold text-emerald-600">
                                {rupiah(g.total)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </Card>

                {/* ── Daftar Pengeluaran ── */}
                <Card className="flex min-h-0 flex-1 flex-col p-0">
                  <div className="shrink-0 border-b border-slate-100 px-4 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Daftar Pengeluaran
                        </h3>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {l.unifiedRows.length} entri
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-red-600">
                          − {rupiah(totalPengeluaran)}
                        </span>
                        {/* Filter jenis pengeluaran inline */}
                        <select
                          value={l.jenisFilter}
                          onChange={(e) => l.setJenisFilter(e.target.value)}
                          className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600 focus:border-brand-400 focus:outline-none"
                        >
                          <option value="all">Semua Jenis</option>
                          <option value="pembelian_supplier">Pembelian Supplier</option>
                          {JENIS_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="min-h-0 flex-1 overflow-auto thin-scroll">
                    {l.isUnifiedLoading ? (
                      <div className="p-4"><Spinner label="Memuat..." /></div>
                    ) : l.unifiedRows.length === 0 ? (
                      <EmptyState title="Belum ada pengeluaran" />
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase text-slate-500">
                          <tr>
                            <th className="px-3 py-2">Tanggal</th>
                            <th className="px-3 py-2">Jenis</th>
                            <th className="px-3 py-2">Deskripsi</th>
                            <th className="px-3 py-2 text-right">Nominal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {l.unifiedRows.map((r) => (
                            <tr
                              key={r.id}
                              onClick={() =>
                                r._type === "purchase"
                                  ? l.openPurchaseDetail(r._rawId)
                                  : l.setViewExpense(r)
                              }
                              className="cursor-pointer transition-colors hover:bg-slate-50/60"
                            >
                              <td className="px-3 py-2 text-xs">{tanggal(r.tanggal)}</td>
                              <td className="px-3 py-2">
                                <Badge tone={JENIS_BADGE_TONE[r.jenis] || "slate"}>
                                  {JENIS_LABELS[r.jenis] || r.jenis}
                                </Badge>
                              </td>
                              <td className="max-w-[160px] truncate px-3 py-2 text-xs text-slate-600">
                                {r.deskripsi}
                              </td>
                              <td className="px-3 py-2 text-right font-semibold text-red-600">
                                − {rupiah(r.nominal)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════
              Tab 2 — Riwayat Transaksi Penjualan
          ════════════════════════════════════════ */}
          {l.activeTab === "transaksi" && (
            <div className="min-h-0 flex-1 overflow-auto thin-scroll p-4">
              <LaporanSummary isSales={true} summary={l.salesSummary} isKasir={l.isKasir} />

              <Card className="mb-3 p-3 no-print">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-36 flex-1">
                    <Select
                      label="Filter Kasir"
                      value={l.kasirFilter}
                      onChange={(e) => { l.setKasirFilter(e.target.value); l.setSalesPage(1); }}
                    >
                      <option value="">Semua Kasir</option>
                      {l.kasirOptions.map((k) => (
                        <option key={k} value={k}>{k}</option>
                      ))}
                    </Select>
                  </div>
                  <Button variant="secondary" onClick={l.exportCsv}>Export CSV</Button>
                </div>
              </Card>

              <LaporanTable
                isSales={true}
                isKasir={l.isKasir}
                isLoading={l.salesQuery.isLoading}
                isEmpty={l.filteredSales.length === 0}
                rows={l.paginatedSales}
                page={l.salesPage}
                pageSize={l.salesPageSize}
                onRowClick={l.setDetailData}
              />

              {l.filteredSales.length > l.salesPageSize && (
                <div className="mt-2 flex items-center justify-between text-sm text-slate-500 no-print">
                  <span>
                    {l.filteredSales.length} baris · halaman {l.salesPage}/{l.salesTotalPages}
                    {l.kasirFilter && ` · kasir: ${l.kasirFilter}`}
                  </span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="secondary" disabled={l.salesPage <= 1}
                      onClick={() => l.setSalesPage((p) => p - 1)}>← Prev</Button>
                    <Button size="sm" variant="secondary" disabled={l.salesPage >= l.salesTotalPages}
                      onClick={() => l.setSalesPage((p) => p + 1)}>Next →</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* ── Modals ── */}
      <PrintPreviewModal
        open={l.printOpen}
        onClose={() => l.setPrintOpen(false)}
        activeTab={l.activeTab}
        from={l.from}
        to={l.to}
        fs={l.fs}
        unifiedRows={l.unifiedRows}
        salesSummary={l.salesSummary}
        filteredSales={l.filteredSales}
        salesGrouped={l.salesGrouped}
      />

      <LaporanDetailModal detailData={l.detailData} isSales={true} onClose={() => l.setDetailData(null)} />

      <PurchaseDetailModal
        detailPurchase={l.detailPurchase}
        loading={l.detailPurchaseLoading}
        onClose={() => l.setDetailPurchase(null)}
      />

      {l.viewExpense && (
        <Modal
          open={true}
          onClose={() => l.setViewExpense(null)}
          title={`Detail Pengeluaran — ${JENIS_LABELS[l.viewExpense.jenis] || l.viewExpense.jenis}`}
          width="max-w-sm"
        >
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 px-4 py-3">
              <div>
                <p className="text-xs text-slate-400">Tanggal</p>
                <p className="font-medium">{tanggal(l.viewExpense.tanggal)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Jenis</p>
                <p className="font-medium">{JENIS_LABELS[l.viewExpense.jenis] || l.viewExpense.jenis}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-slate-400">Deskripsi</p>
                <p className="font-medium">{l.viewExpense.deskripsi}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Dicatat Oleh</p>
                <p className="font-medium">{l.viewExpense.username || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Nominal</p>
                <p className="text-lg font-bold text-red-600">− {rupiah(l.viewExpense.nominal)}</p>
              </div>
            </div>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => l.setViewExpense(null)}>Tutup</Button>
            </div>
          </div>
        </Modal>
      )}
    </PageShell>
  );
}
