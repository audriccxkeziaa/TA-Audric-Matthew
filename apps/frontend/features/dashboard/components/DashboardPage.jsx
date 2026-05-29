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
            onClick={() => d.setOpenModal("transaksi")}
          />
          <ClickableStat
            label="Revenue Hari Ini"
            value={rupiah(s?.revenue_today || 0)}
            tone="good"
            hint="klik untuk detail"
            onClick={() => d.setOpenModal("revenue")}
          />
          <ClickableStat
            label="Stok Masuk (7 hari)"
            value={angka(s?.stock_in_week || 0)}
            hint="unit tervalidasi · klik untuk detail"
            onClick={() => d.setOpenModal("stock-in")}
          />
          <ClickableStat
            label="Stok Menipis"
            value={angka(s?.low_stock_count || 0)}
            tone="warn"
            hint="klik untuk heatmap"
            onClick={() => d.setOpenModal("low-stock")}
          />
          <ClickableStat
            label="Stok Negatif"
            value={angka(s?.negative_stock_count || 0)}
            tone={s?.negative_stock_count ? "bad" : "good"}
            hint="target 0 — bukti R1+R3"
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
        trend={d.trend}
        trendData={d.trendData}
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
