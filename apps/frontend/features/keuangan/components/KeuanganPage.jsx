"use client";
// /keuangan — Manajemen Keuangan (admin only). Orkestrator UI.

import {
  PageShell,
  PageHeader,
  Card,
  StatCard,
  Button,
  Input,
  Select,
  ConfirmDialog,
  Spinner,
  Tabs,
} from "@/components/ui";
import { rupiah, angka } from "@/lib/format";
import { TrendingUp, TrendingDown, Package, Wallet } from "lucide-react";
import { JENIS_OPTIONS } from "../lib/constants";
import { useKeuangan } from "../hooks/useKeuangan";
import { ExpenseFormModal } from "./ExpenseFormModal";
import { SalesTable } from "./SalesTable";
import { UnifiedExpensesTable } from "./ExpensesTable";
import { PurchaseDetailModal } from "./PurchaseDetailModal";
import { SaleDetailModal } from "./SaleDetailModal";

const TABS = [
  { id: "pemasukan", label: "Rincian Pemasukan" },
  { id: "pengeluaran", label: "Daftar Pengeluaran" },
];

export default function KeuanganPage() {
  const k = useKeuangan();
  const { s } = k;

  return (
    <PageShell>
      <PageHeader
        title="Keuangan"
        actions={
          <Button onClick={k.openCreate}>+ Add Operational Cost</Button>
        }
      />

      {/* Filter rentang */}
      <Card className="mb-3 shrink-0 p-3">
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <Input
            label="Dari Tanggal"
            type="date"
            value={k.from}
            onChange={(e) => k.setFrom(e.target.value)}
          />
          <Input
            label="Sampai Tanggal"
            type="date"
            value={k.to}
            onChange={(e) => k.setTo(e.target.value)}
          />
          <Select
            label="Jenis Pengeluaran"
            value={k.jenisFilter}
            onChange={(e) => k.setJenisFilter(e.target.value)}
          >
            <option value="all">Semua Jenis</option>
            <option value="pembelian_supplier">Pembelian Supplier</option>
            {JENIS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <div className="flex items-end">
            <Button variant="secondary" onClick={k.resetFilter} className="w-full">
              Reset Filter
            </Button>
          </div>
        </div>
      </Card>

      {/* Ringkasan saldo */}
      {k.summary.isLoading ? (
        <Card className="shrink-0 p-6">
          <Spinner label="Menghitung saldo..." />
        </Card>
      ) : (
        <div className="mb-3 grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Total Omzet"
            value={rupiah(s?.omset_kotor || 0)}
            tone="good"
            hint={`${angka(s?.n_sales || 0)} transaksi`}
            icon={<TrendingUp size={18} />}
          />
          <StatCard
            label="Pembelian Supplier"
            value={rupiah(s?.total_pembelian || 0)}
            tone="warn"
            hint={`${angka(s?.n_purchases || 0)} nota tervalidasi`}
            icon={<Package size={18} />}
          />
          <StatCard
            label="Pengeluaran Operasional"
            value={rupiah(s?.total_pengeluaran || 0)}
            tone="bad"
            hint={`${angka(s?.n_expenses || 0)} entri`}
            icon={<TrendingDown size={18} />}
          />
          <StatCard
            label="Net Income"
            value={rupiah(s?.saldo_bersih || 0)}
            tone={s?.saldo_bersih >= 0 ? "good" : "bad"}
            icon={<Wallet size={18} />}
            accent
          />
        </div>
      )}

      {/* Tabs + Tabel terpadu */}
      <Card className="flex min-h-0 flex-1 flex-col p-0">
        <Tabs
          tabs={TABS}
          activeTab={k.activeTab}
          onTabChange={k.setActiveTab}
          className="px-4 pt-1"
        />
        <div className="min-h-0 flex-1">
          {k.activeTab === "pemasukan" ? (
            <SalesTable
              rows={k.salesRows}
              isLoading={k.salesList.isLoading}
              onDetail={k.openTrxDetail}
            />
          ) : (
            <UnifiedExpensesTable
              key={`${k.from}-${k.to}-${k.jenisFilter}`}
              rows={k.unifiedRows}
              isLoading={k.isUnifiedLoading}
              onExpenseEdit={k.openEdit}
              onPurchaseDetail={k.openPurchaseDetail}
            />
          )}
        </div>
      </Card>

      {k.openForm && (
        <ExpenseFormModal
          key={k.editing?.id || "new"}
          open={k.openForm}
          editing={k.editing}
          onDelete={(r) => k.setConfirmDel(r)}
          onClose={k.closeForm}
        />
      )}

      <ConfirmDialog
        open={Boolean(k.confirmDel)}
        onClose={() => k.setConfirmDel(null)}
        onConfirm={() => k.del.mutate(k.confirmDel.id)}
        title="Hapus Pengeluaran Operasional"
        message={`Apakah anda yakin akan menghapus "${k.confirmDel?.deskripsi}" senilai ${rupiah(
          k.confirmDel?.nominal || 0
        )}?`}
        confirmLabel="Yes, delete"
      />

      <PurchaseDetailModal
        detailPurchase={k.detailPurchase}
        loading={k.detailPurchaseLoading}
        onClose={() => k.setDetailPurchase(null)}
      />

      <SaleDetailModal
        detailTrx={k.detailTrx}
        loading={k.detailLoading}
        onClose={() => k.setDetailTrx(null)}
      />
    </PageShell>
  );
}
