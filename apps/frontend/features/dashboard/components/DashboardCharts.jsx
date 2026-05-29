"use client";
// Dua grafik dashboard: tren penjualan (pie) & top 10 produk (bar).

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
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

const PIE_COLORS = ["#4f46e5", "#06b6d4", "#f59e0b", "#ef4444", "#10b981", "#8b5cf6", "#ec4899"];

export function DashboardCharts({ trend, trendData, top, topData }) {
  return (
    <div className="mt-3 grid min-h-0 flex-1 gap-3 lg:grid-cols-2">
      <Card className="flex min-h-0 flex-col p-4">
        <h2 className="mb-2 shrink-0 font-semibold text-slate-800">
          Tren Penjualan Harian
          <span className="ml-2 text-xs font-normal text-slate-400">
            {new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}
          </span>
        </h2>
        <div className="min-h-0 flex-1">
          {trend.isLoading ? (
            <Spinner label="Memuat..." />
          ) : trendData.length === 0 ? (
            <EmptyState title="Belum ada data penjualan" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={trendData}
                  dataKey="total_revenue"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  outerRadius="75%"
                  innerRadius="40%"
                  paddingAngle={2}
                  label={({ label, percent }) => `${label} (${(percent * 100).toFixed(0)}%)`}
                  labelLine={{ strokeWidth: 1 }}
                  fontSize={11}
                >
                  {trendData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => [rupiah(v), "Revenue"]} />
                <Legend
                  formatter={(val) => <span className="text-xs">{val}</span>}
                  iconSize={10}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

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
