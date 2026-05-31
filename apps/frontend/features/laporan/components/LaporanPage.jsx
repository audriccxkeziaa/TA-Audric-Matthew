"use client";
// /laporan — Laporan Keuangan (admin). Ringkasan + Arus Kas.

import {
  PageShell, PageHeader, Card, StatCard, Badge,
  Button, Input, Modal, Spinner, EmptyState,
  Table, THead, TH, TBody, TR, TD,
} from "@/components/ui";
import { rupiah, angka, tanggal } from "@/lib/format";
import {
  TrendingUp, TrendingDown, Package, Wallet, Printer, ReceiptText,
  ChevronLeft, ChevronRight, CalendarDays,
} from "lucide-react";
import { useLaporanTerpadu } from "../hooks/useLaporanTerpadu";
import { LaporanDetailModal } from "./LaporanDetailModal";
import { PurchaseDetailModal } from "@/features/keuangan/components/PurchaseDetailModal";
import { PrintPreviewModal } from "./PrintPreviewModal";
import { JENIS_LABELS, JENIS_BADGE_TONE, JENIS_OPTIONS } from "@/features/keuangan/lib/constants";

const MONTHLY_PRESETS = [
  { id: "bulan-ini",  label: "Bulan Ini" },
  { id: "bulan-lalu", label: "Bulan Lalu" },
  { id: "3-bulan",    label: "3 Bulan" },
  { id: "6-bulan",    label: "6 Bulan" },
];

const YEARLY_PRESETS = [
  { id: "tahun-ini",  label: "Tahun Ini" },
  { id: "tahun-lalu", label: "Tahun Lalu" },
];

function PresetGroup({ presets, active, onSelect }) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg bg-slate-100 p-0.5">
      {presets.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onSelect(p.id)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all ${
            active === p.id
              ? "bg-white text-brand-700 shadow-sm ring-1 ring-slate-200/80"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

export default function LaporanPage() {
  const l = useLaporanTerpadu();
  const fs = l.fs;
  const totalPengeluaran = (fs?.total_pembelian || 0) + (fs?.total_pengeluaran || 0);

  return (
    <PageShell>
      <PageHeader
        title="Laporan Keuangan"
        description="Ringkasan arus kas dan rincian pemasukan serta pengeluaran."
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
      <Card className="mb-3 shrink-0 no-print overflow-hidden">
        {/* Main filter bar */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 shrink-0">
            <CalendarDays size={13} />
            Periode
          </span>

          <div className="h-4 w-px bg-slate-200 shrink-0" />

          {/* Bulanan */}
          <PresetGroup
            presets={MONTHLY_PRESETS}
            active={l.periodPreset}
            onSelect={l.applyPreset}
          />

          <div className="h-4 w-px bg-slate-200 shrink-0" />

          {/* Tahunan */}
          <PresetGroup
            presets={YEARLY_PRESETS}
            active={l.periodPreset}
            onSelect={l.applyPreset}
          />

          <div className="h-4 w-px bg-slate-200 shrink-0" />

          {/* Custom */}
          <button
            type="button"
            onClick={() => l.applyPreset("custom")}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              l.periodPreset === "custom"
                ? "border-brand-300 bg-brand-50 text-brand-700"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            Custom
          </button>

          <button
            type="button"
            onClick={l.resetFilter}
            className="rounded-lg px-2.5 py-1.5 text-xs text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            Reset
          </button>

          {/* Active range pill */}
          {l.periodPreset !== "custom" && (l.from || l.to) && (
            <span className="ml-auto shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
              {tanggal(l.from)} — {tanggal(l.to)}
            </span>
          )}
        </div>

        {/* Custom date inputs */}
        {l.periodPreset === "custom" && (
          <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3">
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
          </div>
        )}
      </Card>

      {/* ── Card utama ── */}
      <Card className="flex min-h-0 flex-1 flex-col gap-4 p-4">

        {/* 5 Summary cards */}
        {l.financeSummary.isLoading ? (
          <div className="shrink-0 p-4"><Spinner label="Menghitung saldo..." /></div>
        ) : (
          <div className="grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            <StatCard
              label="Total Omzet"
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
              label="Net Income"
              value={rupiah(fs?.saldo_bersih || 0)}
              tone={fs?.saldo_bersih >= 0 ? "good" : "bad"}
              hint="Total Omzet − Total Pengeluaran"
              icon={<Wallet size={18} />}
              accent
            />
          </div>
        )}

        {/* Split panels */}
        <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">

          {/* ── Rincian Pemasukan ── */}
          <Card className="flex min-h-0 flex-1 flex-col p-0 ring-1 ring-slate-200/60">
            <div className="shrink-0 rounded-t-xl border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-white px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">
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
                  <select
                    value={l.kasirFilter}
                    onChange={(e) => l.setKasirFilter(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 shadow-sm focus:border-brand-400 focus:outline-none"
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
                <Table desktopOnly={false}>
                  <THead>
                    <TH>Tanggal</TH>
                    <TH>Kode Transaksi</TH>
                    <TH>Kasir</TH>
                    <TH className="text-right">Total</TH>
                  </THead>
                  <TBody>
                    {l.filteredSales.map((g) => (
                      <TR key={g.sale_id} onClick={() => l.setDetailData(g)}>
                        <TD className="text-xs">{tanggal(g.created_at)}</TD>
                        <TD className="font-mono text-xs text-brand-700">{g.kode_transaksi}</TD>
                        <TD className="text-xs text-slate-500">{g.kasir}</TD>
                        <TD className="text-right font-semibold text-emerald-600">
                          {rupiah(g.total)}
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </div>
          </Card>

          {/* ── Daftar Pengeluaran ── */}
          <Card className="flex min-h-0 flex-1 flex-col p-0 ring-1 ring-slate-200/60">
            <div className="shrink-0 rounded-t-xl border-b border-slate-100 bg-gradient-to-r from-red-50 to-white px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">
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
                  <select
                    value={l.jenisFilter}
                    onChange={(e) => l.setJenisFilter(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 shadow-sm focus:border-brand-400 focus:outline-none"
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
                <Table desktopOnly={false}>
                  <THead>
                    <TH>Tanggal</TH>
                    <TH>Jenis</TH>
                    <TH>Deskripsi</TH>
                    <TH className="text-right">Nominal</TH>
                  </THead>
                  <TBody>
                    {l.paginatedUnifiedRows.map((r) => (
                      <TR
                        key={r.id}
                        onClick={() =>
                          r._type === "purchase"
                            ? l.openPurchaseDetail(r._rawId)
                            : l.setViewExpense(r)
                        }
                      >
                        <TD className="text-xs">{tanggal(r.tanggal)}</TD>
                        <TD>
                          <Badge tone={JENIS_BADGE_TONE[r.jenis] || "slate"} dot>
                            {JENIS_LABELS[r.jenis] || r.jenis}
                          </Badge>
                        </TD>
                        <TD className="max-w-[160px] truncate text-xs text-slate-600">
                          {r.deskripsi}
                        </TD>
                        <TD className="text-right font-semibold text-red-600">
                          − {rupiah(r.nominal)}
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </div>

            {/* Pagination pengeluaran */}
            {l.unifiedRows.length > l.expensePageSize && (
              <div className="shrink-0 border-t border-slate-100 px-4 py-2.5 no-print">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-500">
                    {l.unifiedRows.length} entri · hal {l.expensePage}/{l.expenseTotalPages}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={l.expensePage <= 1}
                      onClick={() => l.setExpensePage((p) => p - 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    {Array.from({ length: l.expenseTotalPages }, (_, i) => i + 1)
                      .filter((p) =>
                        p === 1 ||
                        p === l.expenseTotalPages ||
                        Math.abs(p - l.expensePage) <= 1
                      )
                      .reduce((acc, p, i, arr) => {
                        if (i > 0 && p - arr[i - 1] > 1) acc.push("…");
                        acc.push(p);
                        return acc;
                      }, [])
                      .map((p, i) =>
                        p === "…" ? (
                          <span key={`ellipsis-${i}`} className="px-1 text-xs text-slate-400">…</span>
                        ) : (
                          <button
                            key={p}
                            type="button"
                            onClick={() => l.setExpensePage(p)}
                            className={`flex h-7 w-7 items-center justify-center rounded-lg border text-xs font-medium transition ${
                              l.expensePage === p
                                ? "border-brand-500 bg-brand-600 text-white shadow-sm"
                                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            {p}
                          </button>
                        )
                      )}
                    <button
                      type="button"
                      disabled={l.expensePage >= l.expenseTotalPages}
                      onClick={() => l.setExpensePage((p) => p + 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>
      </Card>

      {/* ── Modals ── */}
      <PrintPreviewModal
        open={l.printOpen}
        onClose={() => l.setPrintOpen(false)}
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
                <Badge tone={JENIS_BADGE_TONE[l.viewExpense.jenis] || "slate"} dot>
                  {JENIS_LABELS[l.viewExpense.jenis] || l.viewExpense.jenis}
                </Badge>
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
