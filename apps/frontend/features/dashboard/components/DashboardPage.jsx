"use client";

import { rupiah, angka } from "@/lib/format";
import { PageShell, PageHeader, Card, StatCard, Spinner } from "@/components/ui";
import { useDashboard } from "../hooks/useDashboard";
import { DashboardCharts } from "./DashboardCharts";

function I({ d }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {d}
    </svg>
  );
}
const ICONS = {
  transaksi:   <I d={<><path d="M4 4h12l1 14H3z" /><path d="M8 9h6M8 13h4" /></>} />,
  revenue:     <I d={<><path d="M12 1v22" /><path d="M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6" /></>} />,
  lowStock:    <I d={<><path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" /><path d="M12 9v4M12 17h.01" /></>} />,
  grossProfit: <I d={<><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></>} />,
  habis:       <I d={<><path d="M21 16V8a2 2 0 00-1-1.7l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.7l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" /><line x1="3.3" y1="7" x2="12" y2="12" /><line x1="20.7" y1="7" x2="12" y2="12" /><line x1="12" y1="22" x2="12" y2="12" /></>} />,
  kritis:      <I d={<><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></>} />,
};

const PERIOD_OPTIONS = [
  { id: "today", label: "Hari Ini" },
  { id: "week",  label: "Minggu Ini" },
  { id: "month", label: "Bulan Ini" },
];

function PeriodToggle({ period, setPeriod }) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg bg-slate-100 p-0.5 no-print">
      {PERIOD_OPTIONS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => setPeriod(opt.id)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all ${
            period === opt.id
              ? "bg-white text-brand-700 shadow-sm ring-1 ring-slate-200/80"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const d = useDashboard();
  const { s } = d;

  return (
    <PageShell>
      <PageHeader
        title="Dashboard"
        description="Overview toko & analitik penjualan."
        actions={<PeriodToggle period={d.period} setPeriod={d.setPeriod} />}
      />

      {d.summary.isLoading ? (
        <Card className="shrink-0 p-6">
          <Spinner label="Memuat ringkasan..." />
        </Card>
      ) : (
        <div className="grid shrink-0 gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          <StatCard
            label="Total Transaksi"
            value={angka(s?.tx_today_count || 0)}
            hint="total transaksi"
            icon={ICONS.transaksi}
          />
          <StatCard
            label="Total Omzet"
            value={rupiah(s?.revenue_today || 0)}
            tone="good"
            hint="omzet kotor"
            icon={ICONS.revenue}
          />
          <StatCard
            label="Stok Menipis"
            value={angka(s?.low_stock_count || 0)}
            tone="warn"
            hint="Produk ≤ Min Stok"
            icon={ICONS.lowStock}
          />
          <StatCard
            label="Gross Profit"
            value={rupiah(s?.gross_profit || 0)}
            tone="good"
            hint="Total Omzet − Total Pengeluaran"
            icon={ICONS.grossProfit}
          />
          <StatCard
            label="Stok Habis"
            value={angka(s?.stok_habis_count || 0)}
            tone={(s?.stok_habis_count || 0) > 0 ? "bad" : "good"}
            hint="produk dengan stok = 0"
            icon={ICONS.habis}
          />
          <StatCard
            label="Stok Kritis"
            value={angka(s?.stok_kritis_count || 0)}
            tone={(s?.stok_kritis_count || 0) > 0 ? "bad" : "good"}
            hint="di bawah reorder point"
            icon={ICONS.kritis}
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
        isLoadingCombined={d.trend.isLoading}
        top={d.top}
        topData={d.topData}
      />
    </PageShell>
  );
}
