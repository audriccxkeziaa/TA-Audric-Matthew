"use client";
// /keuangan — Manajemen Keuangan (admin only). Orkestrator UI.

import {
  PageShell,
  PageHeader,
  Card,
  StatCard,
  Badge,
  Button,
  Input,
  Select,
  ConfirmDialog,
  Spinner,
} from "@/components/ui";
import { rupiah, angka } from "@/lib/format";
import { TrendingUp, Package, ReceiptText, Wallet } from "lucide-react";
import { JENIS_OPTIONS, JENIS_TONE } from "../lib/constants";
import { useKeuangan } from "../hooks/useKeuangan";
import { ExpenseFormModal } from "./ExpenseFormModal";
import { JenisDetailModal } from "./JenisDetailModal";
import { SalesIncomeCard } from "./SalesIncomeCard";
import { PurchasesCard } from "./PurchasesCard";
import { ExpensesTable } from "./ExpensesTable";
import { PurchaseDetailModal } from "./PurchaseDetailModal";
import { SaleDetailModal } from "./SaleDetailModal";

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
            label="Pendapatan Kotor"
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
            tone="warn"
            hint={`${angka(s?.n_expenses || 0)} entri`}
            icon={<ReceiptText size={18} />}
          />
          <StatCard
            label="Pendapatan Bersih"
            value={rupiah(s?.saldo_bersih || 0)}
            tone={s?.saldo_bersih >= 0 ? "good" : "bad"}
            icon={<Wallet size={18} />}
            accent
          />
        </div>
      )}

      {/* Breakdown pengeluaran per jenis — clickable */}
      {s?.per_jenis && (
        <Card className="mb-3 shrink-0 p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            Breakdown Pengeluaran Operasional · klik kotak untuk detail
          </p>
          <div className="flex flex-wrap gap-2">
            {JENIS_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => k.setJenisDetail(o.value)}
                className="group flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm transition hover:-translate-y-0.5 hover:border-brand-400 hover:bg-brand-50 hover:shadow-sm"
              >
                <Badge tone={JENIS_TONE[o.value]}>{o.label}</Badge>
                <span className="font-semibold">{rupiah(s.per_jenis[o.value] || 0)}</span>
                <span className="ml-1 text-[10px] text-slate-400 group-hover:text-brand-600">↗</span>
              </button>
            ))}
          </div>
        </Card>
      )}

      <SalesIncomeCard
        omsetKotor={s?.omset_kotor}
        salesRows={k.salesRows}
        salesLoading={k.salesList.isLoading}
        showSales={k.showSales}
        onOpen={() => k.setShowSales(true)}
        onClose={() => {
          k.setShowSales(false);
          k.setSalesPage(1);
        }}
        salesPage={k.salesPage}
        setSalesPage={k.setSalesPage}
        onTrxDetail={(id) => {
          k.setShowSales(false);
          k.openTrxDetail(id);
        }}
      />

      <PurchasesCard
        totalPembelian={s?.total_pembelian}
        purchasesRows={k.purchasesRows}
        purchasesLoading={k.purchasesList.isLoading}
        showPurchases={k.showPurchases}
        onOpen={() => k.setShowPurchases(true)}
        onClose={() => {
          k.setShowPurchases(false);
          k.setPurchasesPage(1);
        }}
        purchasesPage={k.purchasesPage}
        setPurchasesPage={k.setPurchasesPage}
        onPurchaseDetail={(id) => {
          k.setShowPurchases(false);
          k.openPurchaseDetail(id);
        }}
      />

      <ExpensesTable rows={k.rows} isLoading={k.list.isLoading} onEdit={k.openEdit} />

      {k.openForm && (
        <ExpenseFormModal
          key={k.editing?.id || "new"}
          open={k.openForm}
          editing={k.editing}
          onDelete={(r) => k.setConfirmDel(r)}
          onClose={k.closeForm}
        />
      )}

      <JenisDetailModal
        open={Boolean(k.jenisDetail)}
        onClose={() => k.setJenisDetail(null)}
        jenis={k.jenisDetail}
        rows={k.rows}
      />

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
