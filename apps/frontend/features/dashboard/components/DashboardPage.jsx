"use client";
// /dashboard — Dashboard Analitik Admin. Orkestrator UI.
// 5 kartu metrik clickable → modal detail; 2 grafik mengisi sisa viewport.

import { rupiah, angka } from "@/lib/format";
import { PageShell, PageHeader, Card, Spinner } from "@/components/ui";
import { useDashboard } from "../hooks/useDashboard";
import { ClickableStat } from "./ClickableStat";
import { DashboardCharts } from "./DashboardCharts";
import { TransaksiTodayModal } from "./TransaksiTodayModal";
import { RevenueTodayModal } from "./RevenueTodayModal";
import { StockInModal } from "./StockInModal";
import { LowStockHeatmapModal } from "./LowStockHeatmapModal";
import { NegativeStockModal } from "./NegativeStockModal";

// Ikon kecil untuk kartu metrik (stroke, 20px).
function I({ d }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {d}
    </svg>
  );
}
const ICONS = {
  transaksi: <I d={<><path d="M4 4h12l1 14H3z" /><path d="M8 9h6M8 13h4" /></>} />,
  revenue: <I d={<><path d="M12 1v22" /><path d="M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6" /></>} />,
  stockIn: <I d={<><path d="M21 16V8a2 2 0 00-1-1.7l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.7l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" /><path d="M3.3 7L12 12l8.7-5M12 22V12" /></>} />,
  lowStock: <I d={<><path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" /><path d="M12 9v4M12 17h.01" /></>} />,
  negative: <I d={<><path d="M23 18l-9.5-9.5-5 5L1 6" /><path d="M17 18h6v-6" /></>} />,
};

export default function DashboardPage() {
  const d = useDashboard();
  const { s } = d;

  return (
    <PageShell>
      <PageHeader
        title="Dashboard"
        description="Ringkasan operasional toko & analitik penjualan. Klik kartu mana saja untuk detail."
      />

      {/* Kartu metrik — clickable */}
      {d.summary.isLoading ? (
        <Card className="shrink-0 p-6">
          <Spinner label="Memuat ringkasan..." />
        </Card>
      ) : (
        <div className="grid shrink-0 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <ClickableStat
            label="Transaksi Hari Ini"
            value={angka(s?.tx_today_count || 0)}
            hint="klik untuk detail"
            icon={ICONS.transaksi}
            onClick={() => d.setOpenModal("transaksi")}
          />
          <ClickableStat
            label="Revenue Hari Ini"
            value={rupiah(s?.revenue_today || 0)}
            tone="good"
            hint="klik untuk detail"
            icon={ICONS.revenue}
            onClick={() => d.setOpenModal("revenue")}
          />
          <ClickableStat
            label="Stok Masuk (7 hari)"
            value={angka(s?.stock_in_week || 0)}
            hint="unit tervalidasi · klik untuk detail"
            icon={ICONS.stockIn}
            onClick={() => d.setOpenModal("stock-in")}
          />
          <ClickableStat
            label="Stok Menipis"
            value={angka(s?.low_stock_count || 0)}
            tone="warn"
            hint="klik untuk heatmap"
            icon={ICONS.lowStock}
            onClick={() => d.setOpenModal("low-stock")}
          />
          <ClickableStat
            label="Stok Negatif"
            value={angka(s?.negative_stock_count || 0)}
            tone={s?.negative_stock_count ? "bad" : "good"}
            hint="target 0 — bukti R1+R3"
            icon={ICONS.negative}
            onClick={() => d.setOpenModal("negative")}
          />
        </div>
      )}

      {s?.r1_rejected_today > 0 && (
        <p className="mt-2 shrink-0 text-xs text-slate-500">
          R1 menolak {s.r1_rejected_today} percobaan transaksi stok kurang
          hari ini — semua tercatat di audit trail.
        </p>
      )}

      <DashboardCharts
        combinedData={d.combinedData}
        isLoadingCombined={d.trend.isLoading || d.expense.isLoading}
        top={d.top}
        topData={d.topData}
      />

      {/* Modals */}
      <TransaksiTodayModal
        open={d.openModal === "transaksi"}
        onClose={() => d.setOpenModal(null)}
      />
      <RevenueTodayModal
        open={d.openModal === "revenue"}
        onClose={() => d.setOpenModal(null)}
      />
      <StockInModal
        open={d.openModal === "stock-in"}
        onClose={() => d.setOpenModal(null)}
      />
      <LowStockHeatmapModal
        open={d.openModal === "low-stock"}
        onClose={() => d.setOpenModal(null)}
      />
      <NegativeStockModal
        open={d.openModal === "negative"}
        onClose={() => d.setOpenModal(null)}
        count={s?.negative_stock_count || 0}
      />
    </PageShell>
  );
}
