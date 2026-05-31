"use client";
// /laporan — Laporan Terpadu (admin). 3 tab: Keuangan, Transaksi Penjualan, Stok.

import {
  PageShell,
  PageHeader,
  Card,
  StatCard,
  Button,
  Input,
  Select,
  Modal,
  Tabs,
  Spinner,
} from "@/components/ui";
import { rupiah, angka, tanggal } from "@/lib/format";
import { TrendingUp, TrendingDown, Package, Wallet, Printer } from "lucide-react";
import { useLaporanTerpadu } from "../hooks/useLaporanTerpadu";
import { LaporanTable } from "./LaporanTable";
import { LaporanDetailModal } from "./LaporanDetailModal";
import { LaporanSummary } from "./LaporanSummary";
import { UnifiedExpensesTable } from "@/features/keuangan/components/ExpensesTable";
import { RestockTable } from "@/features/restock/components/RestockTable";
import { RestockDetailModal } from "@/features/restock/components/RestockDetailModal";
import { PurchaseDetailModal } from "@/features/keuangan/components/PurchaseDetailModal";
import { PrintPreviewModal } from "./PrintPreviewModal";
import { JENIS_LABELS } from "@/features/keuangan/lib/constants";

const TABS = [
  { id: "keuangan", label: "Ringkasan & Keuangan" },
  { id: "transaksi", label: "Riwayat Transaksi Penjualan" },
  { id: "stok", label: "Kondisi Persediaan & Stok" },
];

export default function LaporanPage() {
  const l = useLaporanTerpadu();

  return (
    <PageShell>
      <PageHeader
        title="Laporan Terpadu"
        description="Ringkasan keuangan, riwayat penjualan, dan kondisi persediaan stok."
        actions={
          <div className="flex gap-2 no-print">
            <Button variant="secondary" onClick={l.exportCsv}>
              Export CSV
            </Button>
            <Button onClick={() => l.setPrintOpen(true)}>
              <Printer size={16} />
              Cetak Laporan
            </Button>
          </div>
        }
      />

      {/* Filter tanggal — bersama untuk semua tab */}
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
          <div />
          <div className="flex items-end">
            <Button variant="secondary" onClick={l.resetFilter} className="w-full">
              Reset Filter
            </Button>
          </div>
        </div>
      </Card>

      {/* Card utama: Tabs + konten */}
      <Card className="flex min-h-0 flex-1 flex-col p-0">
        <Tabs
          tabs={TABS}
          activeTab={l.activeTab}
          onTabChange={l.setActiveTab}
          className="px-4 pt-1 no-print"
        />

        <div className="min-h-0 flex-1 overflow-auto thin-scroll">

          {/* ══════════════════════════════════════════
              Tab 1 — Ringkasan & Keuangan
          ══════════════════════════════════════════ */}
          {l.activeTab === "keuangan" && (
            <div className="p-4">
              {l.financeSummary.isLoading ? (
                <div className="mb-4 p-6">
                  <Spinner label="Menghitung saldo..." />
                </div>
              ) : (
                <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <StatCard
                    label="Pendapatan Kotor"
                    value={rupiah(l.fs?.omset_kotor || 0)}
                    tone="good"
                    hint={`${angka(l.fs?.n_sales || 0)} transaksi`}
                    icon={<TrendingUp size={18} />}
                  />
                  <StatCard
                    label="Pembelian Supplier"
                    value={rupiah(l.fs?.total_pembelian || 0)}
                    tone="warn"
                    hint={`${angka(l.fs?.n_purchases || 0)} nota tervalidasi`}
                    icon={<Package size={18} />}
                  />
                  <StatCard
                    label="Pengeluaran Operasional"
                    value={rupiah(l.fs?.total_pengeluaran || 0)}
                    tone="bad"
                    hint={`${angka(l.fs?.n_expenses || 0)} entri`}
                    icon={<TrendingDown size={18} />}
                  />
                  <StatCard
                    label="Pendapatan Bersih"
                    value={rupiah(l.fs?.saldo_bersih || 0)}
                    tone={l.fs?.saldo_bersih >= 0 ? "good" : "bad"}
                    icon={<Wallet size={18} />}
                    accent
                  />
                </div>
              )}

              {/* Tabel pengeluaran terpadu */}
              <UnifiedExpensesTable
                key={`${l.from}-${l.to}`}
                rows={l.unifiedRows}
                isLoading={l.isUnifiedLoading}
                onExpenseEdit={l.setViewExpense}
                onPurchaseDetail={l.openPurchaseDetail}
              />
            </div>
          )}

          {/* ══════════════════════════════════════════
              Tab 2 — Riwayat Transaksi Penjualan
          ══════════════════════════════════════════ */}
          {l.activeTab === "transaksi" && (
            <div className="p-4">
              <LaporanSummary
                isSales={true}
                summary={l.salesSummary}
                isKasir={l.isKasir}
              />

              {/* Sub-filter kasir */}
              <Card className="mb-3 p-3 no-print">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex-1 min-w-36">
                    <Select
                      label="Filter Kasir"
                      value={l.kasirFilter}
                      onChange={(e) => {
                        l.setKasirFilter(e.target.value);
                        l.setSalesPage(1);
                      }}
                    >
                      <option value="">Semua Kasir</option>
                      {l.kasirOptions.map((k) => (
                        <option key={k} value={k}>{k}</option>
                      ))}
                    </Select>
                  </div>
                  <Button variant="secondary" onClick={l.exportCsv}>
                    Export CSV
                  </Button>
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
                    {l.filteredSales.length} baris · halaman {l.salesPage}/
                    {l.salesTotalPages}
                    {l.kasirFilter && ` · kasir: ${l.kasirFilter}`}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={l.salesPage <= 1}
                      onClick={() => l.setSalesPage((p) => p - 1)}
                    >
                      ← Prev
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={l.salesPage >= l.salesTotalPages}
                      onClick={() => l.setSalesPage((p) => p + 1)}
                    >
                      Next →
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════
              Tab 3 — Kondisi Persediaan & Stok
          ══════════════════════════════════════════ */}
          {l.activeTab === "stok" && (
            <div className="p-4">
              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard
                  label="Total Butuh Restock"
                  value={angka(l.restockSummary.total)}
                />
                <StatCard
                  label="Stok Habis"
                  value={angka(l.restockSummary.habis)}
                  tone="bad"
                />
                <StatCard
                  label="Stok Kritis"
                  value={angka(l.restockSummary.kritis)}
                  tone="warn"
                />
                <StatCard
                  label="Stok Menipis"
                  value={angka(l.restockSummary.menipis)}
                />
              </div>

              <Card className="mb-3 p-3 no-print">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-slate-700">
                    Filter Kondisi:
                  </span>
                  <Select
                    value={l.stockFilter}
                    onChange={(e) => {
                      l.setStockFilter(e.target.value);
                      l.setRestockPage(1);
                    }}
                  >
                    <option value="all">Semua Kondisi</option>
                    <option value="HABIS">Stok Habis</option>
                    <option value="KRITIS">Stok Kritis</option>
                    <option value="MENIPIS">Stok Menipis</option>
                  </Select>
                </div>
              </Card>

              <RestockTable
                rows={l.paginatedRestock}
                isEmpty={l.restockItems.length === 0}
                isLoading={l.restockQuery.isLoading}
                isAdmin={true}
                page={l.restockPage}
                pageSize={l.restockPageSize}
                onDetail={l.setDetailRestock}
                onEdit={() => {}}
              />

              {l.restockItems.length > l.restockPageSize && (
                <div className="mt-2 flex items-center justify-between text-sm text-slate-500 no-print">
                  <span>
                    {l.restockItems.length} item · halaman {l.restockPage}/
                    {l.restockTotalPages}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={l.restockPage <= 1}
                      onClick={() => l.setRestockPage((p) => p - 1)}
                    >
                      ← Prev
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={l.restockPage >= l.restockTotalPages}
                      onClick={() => l.setRestockPage((p) => p + 1)}
                    >
                      Next →
                    </Button>
                  </div>
                </div>
              )}

              <div className="mt-3 space-y-0.5 text-xs text-slate-400 no-print">
                <p>
                  <span className="font-medium text-slate-500">Perlu Beli</span>
                  {" "}= Min Stok − Stok Sekarang.
                </p>
                <p>
                  <span className="font-medium text-slate-500">ROP</span>
                  {" "}= Reorder Point: batas stok sebelum harus pesan ulang agar tidak kehabisan.
                </p>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* ── Modals ── */}

      {/* Print preview */}
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
        restockSummary={l.restockSummary}
        restockItems={l.restockItems}
      />

      {/* Detail transaksi penjualan */}
      <LaporanDetailModal
        detailData={l.detailData}
        isSales={true}
        onClose={() => l.setDetailData(null)}
      />

      {/* Detail nota pembelian */}
      <PurchaseDetailModal
        detailPurchase={l.detailPurchase}
        loading={l.detailPurchaseLoading}
        onClose={() => l.setDetailPurchase(null)}
      />

      {/* Detail item restock (view-only) */}
      {l.detailRestock && (
        <RestockDetailModal
          item={l.detailRestock}
          onClose={() => l.setDetailRestock(null)}
          viewOnly
        />
      )}

      {/* Detail pengeluaran operasional (read-only) */}
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
                <p className="font-medium">
                  {JENIS_LABELS[l.viewExpense.jenis] || l.viewExpense.jenis}
                </p>
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
                <p className="text-lg font-bold text-red-600">
                  − {rupiah(l.viewExpense.nominal)}
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => l.setViewExpense(null)}>
                Tutup
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </PageShell>
  );
}
