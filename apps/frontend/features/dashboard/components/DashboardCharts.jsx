"use client";
// Dua grafik dashboard: Pendapatan vs Pengeluaran (area) & top 10 produk (bar).

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { rupiah } from "@/lib/format";
import { Card, Spinner, EmptyState } from "@/components/ui";

// Format angka singkat untuk sumbu Y
function fmtAxis(v) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}jt`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}rb`;
  return String(v);
}

// Tooltip kustom dengan layout rapi
function RevenueExpenseTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xl text-xs">
      <p className="mb-2 font-semibold text-slate-600">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-6 py-0.5">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-slate-500">
              {p.dataKey === "pendapatan" ? "Pendapatan" : "Pengeluaran"}
            </span>
          </div>
          <span className="font-semibold tabular-nums" style={{ color: p.color }}>
            {rupiah(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function DashboardCharts({ combinedData, isLoadingCombined, top, topData }) {
  const hasData = combinedData.some((d) => d.pendapatan > 0 || d.pengeluaran > 0);

  return (
    <div className="mt-3 grid min-h-0 flex-1 gap-3 lg:grid-cols-2">
      {/* ── Pendapatan vs Pengeluaran ── */}
      <Card className="flex min-h-0 flex-col p-4">
        <div className="mb-3 shrink-0 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Pendapatan vs Pengeluaran</h2>
          <span className="text-xs text-slate-400">30 hari terakhir</span>
        </div>

        <div className="min-h-0 flex-1">
          {isLoadingCombined ? (
            <Spinner label="Memuat..." />
          ) : !hasData ? (
            <EmptyState title="Belum ada data" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={combinedData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradPendapatan" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradPengeluaran" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#f43f5e" stopOpacity={0} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="label"
                  fontSize={10}
                  tick={{ fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                  interval={4}
                />
                <YAxis
                  fontSize={10}
                  tick={{ fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={fmtAxis}
                  width={48}
                />
                <Tooltip content={<RevenueExpenseTooltip />} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(val) => (
                    <span className="text-xs text-slate-600">
                      {val === "pendapatan" ? "Pendapatan" : "Pengeluaran"}
                    </span>
                  )}
                />
                <Area
                  type="monotone"
                  dataKey="pendapatan"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#gradPendapatan)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
                <Area
                  type="monotone"
                  dataKey="pengeluaran"
                  stroke="#f43f5e"
                  strokeWidth={2}
                  fill="url(#gradPengeluaran)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                  strokeDasharray="4 2"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* ── Top 10 Produk Terlaris ── */}
      <Card className="flex min-h-0 flex-col p-4">
        <h2 className="mb-2 shrink-0 font-semibold text-slate-800">
          10 Produk Terlaris (30 hari)
        </h2>
        <div className="min-h-0 flex-1">
          {top.isLoading ? (
            <Spinner label="Memuat..." />
          ) : topData.length === 0 ? (
            <EmptyState title="Belum ada penjualan" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" fontSize={11} />
                <YAxis
                  type="category"
                  dataKey="nama"
                  width={140}
                  fontSize={10}
                />
                <Tooltip formatter={(v) => [v, "Qty terjual"]} />
                <Bar dataKey="total_qty" fill="#4f46e5" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>
    </div>
  );
}
