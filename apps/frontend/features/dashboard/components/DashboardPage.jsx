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
  grossProfit: <I d={<><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></>} />,
  stok:        <I d={<><path d="M21 16V8a2 2 0 00-1-1.7l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.7l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" /><path d="M3.3 7L12 12l8.7-5M12 22V12" /></>} />,
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

function StokCard({ menipis, habis, kritis }) {
  const items = [
    { label: "Menipis", value: menipis, color: "text-amber-600", bg: "bg-amber-50/60 ring-1 ring-amber-100/60" },
    { label: "Habis",   value: habis,   color: "text-red-600",   bg: "bg-red-50/60 ring-1 ring-red-100/60" },
    { label: "Kritis",  value: kritis,  color: "text-red-700",   bg: "bg-red-50/60 ring-1 ring-red-100/60" },
  ];

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Status Stok</p>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50/50 text-brand-600 ring-1 ring-brand-100/50">
          {ICONS.stok}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {items.map((item) => (
          <div key={item.label} className={`rounded-lg px-2 py-2 text-center ${item.bg}`}>
            <p className={`text-xl font-bold tabular-nums ${item.color}`}>{angka(item.value || 0)}</p>
            <p className="mt-0.5 text-[10px] font-medium text-slate-500">{item.label}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function JualRugiAlert({ items = [] }) {
  if (!items.length) return null;
  return (
    <Card className="mt-3 shrink-0 border-red-200 bg-red-50/60 p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-600">
          <I d={<><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><path d="M12 9v4M12 17h.01" /></>} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-red-700">
            {items.length} barang berpotensi jual rugi
          </p>
          <p className="mt-0.5 text-xs text-red-600/80">
            Harga jual ≤ harga beli. Segera sesuaikan harga jual di Master Barang
            (harga beli bisa naik otomatis saat stok masuk).
          </p>
          <div className="mt-2 max-h-44 overflow-auto rounded-lg bg-white/70 ring-1 ring-red-100">
            <table className="w-full text-xs">
              <thead className="text-slate-400">
                <tr>
                  <th className="px-2 py-1 text-left font-medium">Barang</th>
                  <th className="px-2 py-1 text-right font-medium">Harga Beli</th>
                  <th className="px-2 py-1 text-right font-medium">Harga Jual</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-50">
                {items.map((it) => (
                  <tr key={it.id}>
                    <td className="px-2 py-1">
                      <span className="font-medium text-slate-700">{it.nama_barang}</span>
                      <span className="block font-mono text-[10px] text-slate-400">{it.kode_barang}</span>
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums text-slate-600">{rupiah(it.harga_beli)}</td>
                    <td className="px-2 py-1 text-right tabular-nums font-semibold text-red-600">{rupiah(it.harga_jual)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Card>
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
        <div className="grid shrink-0 gap-3 grid-cols-2 lg:grid-cols-4">
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
            label="Gross Profit"
            value={rupiah(s?.gross_profit || 0)}
            tone="good"
            hint="Total Omzet − Harga Beli"
            icon={ICONS.grossProfit}
          />
          <StokCard
            menipis={s?.low_stock_count}
            habis={s?.stok_habis_count}
            kritis={s?.stok_kritis_count}
          />
        </div>
      )}

      {!d.summary.isLoading && <JualRugiAlert items={s?.jual_rugi_items} />}

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
