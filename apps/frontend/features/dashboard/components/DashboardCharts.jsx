"use client";
// Dua grafik dashboard: Tren Pendapatan & Pengeluaran (ComposedChart) & top 10 produk (custom bars).

import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { rupiah } from "@/lib/format";
import { Card, Spinner, EmptyState } from "@/components/ui";

// Format angka singkat untuk sumbu Y kiri (rupiah)
function fmtAxis(v) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}jt`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}rb`;
  return String(v);
}

// Tooltip kustom untuk ComposedChart (3 series + transaksi)
function TrenTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const labelMap = {
    pendapatan: "Omzet",
    pendapatan_bersih: "Est. Pendapatan Bersih",
    n_tx: "Transaksi",
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xl text-xs min-w-[190px]">
      <p className="mb-2 font-semibold text-slate-600">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-6 py-0.5">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-slate-500">{labelMap[p.dataKey] ?? p.name}</span>
          </div>
          <span className="font-semibold tabular-nums" style={{ color: p.color }}>
            {p.dataKey === "n_tx" ? `${p.value} trx` : rupiah(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

// Satu item legend kustom (dot + teks)
function LegendItem({ color, label }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-xs text-slate-500">{label}</span>
    </div>
  );
}

// ── Warna gradient per ranking (1–10) ──
const RANK_GRADIENTS = [
  ["#f59e0b", "#f97316"], // 1 amber→orange
  ["#10b981", "#059669"], // 2 emerald
  ["#6366f1", "#4f46e5"], // 3 indigo
  ["#8b5cf6", "#7c3aed"], // 4 violet
  ["#f43f5e", "#e11d48"], // 5 rose
  ["#06b6d4", "#0891b2"], // 6 cyan
  ["#84cc16", "#65a30d"], // 7 lime
  ["#ec4899", "#db2777"], // 8 pink
  ["#14b8a6", "#0d9488"], // 9 teal
  ["#fb923c", "#ea580c"], // 10 orange-dark
];

// Baris progress-bar satu produk
function ProductBar({ rank, nama, nama_barang, total_qty, maxQty }) {
  const colors = RANK_GRADIENTS[(rank - 1) % RANK_GRADIENTS.length];
  const pct = maxQty > 0 ? (total_qty / maxQty) * 100 : 0;

  return (
    <div
      className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-slate-50 cursor-default"
      title={nama_barang}
    >
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
        style={{ background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})` }}
      >
        {rank}
      </span>

      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="truncate text-xs font-medium text-slate-700">{nama}</span>
          <span className="shrink-0 text-xs font-bold tabular-nums" style={{ color: colors[0] }}>
            {total_qty}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${pct}%`,
              background: `linear-gradient(90deg, ${colors[0]}, ${colors[1]})`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

export function DashboardCharts({ combinedData, isLoadingCombined, top, topData }) {
  const hasData = combinedData.some((d) => d.pendapatan > 0 || d.pengeluaran > 0);
  const maxQty = topData[0]?.total_qty || 1;

  return (
    <div className="mt-3 grid min-h-0 flex-1 gap-3 lg:grid-cols-2">

      {/* ── Tren Pendapatan & Pengeluaran ── */}
      <Card className="flex min-h-0 flex-col p-4">
        <div className="mb-3 shrink-0 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Tren Pendapatan &amp; Pengeluaran</h2>
          <span className="text-xs text-slate-400">30 hari terakhir</span>
        </div>

        <div className="min-h-0 flex-1 flex flex-col gap-2">
          {isLoadingCombined ? (
            <Spinner label="Memuat..." />
          ) : !hasData ? (
            <EmptyState title="Belum ada data" />
          ) : (
            <>
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={combinedData} margin={{ top: 8, right: 36, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradOmzet" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="gradBersih" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.45} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
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
                      yAxisId="rp"
                      fontSize={10}
                      tick={{ fill: "#94a3b8" }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={fmtAxis}
                      width={48}
                    />
                    <YAxis
                      yAxisId="tx"
                      orientation="right"
                      fontSize={10}
                      tick={{ fill: "#94a3b8" }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                      width={28}
                    />
                    <Tooltip content={<TrenTooltip />} />

                    <Bar
                      yAxisId="tx"
                      dataKey="n_tx"
                      name="Total Transaksi"
                      fill="#fb923c"
                      fillOpacity={0.55}
                      radius={[3, 3, 0, 0]}
                      barSize={8}
                    />
                    <Area
                      yAxisId="rp"
                      type="monotone"
                      dataKey="pendapatan"
                      name="Omzet"
                      stroke="#6366f1"
                      strokeWidth={2}
                      fill="url(#gradOmzet)"
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 0 }}
                    />
                    <Area
                      yAxisId="rp"
                      type="monotone"
                      dataKey="pendapatan_bersih"
                      name="Estimasi Pendapatan Bersih"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      fill="url(#gradBersih)"
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 0 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Legend kustom — dot + label teks */}
              <div className="shrink-0 flex items-center justify-center gap-5 flex-wrap pb-1">
                <LegendItem color="#fb923c" label="Total Transaksi" />
                <LegendItem color="#6366f1" label="Omzet" />
                <LegendItem color="#10b981" label="Estimasi Pendapatan Bersih" />
              </div>
            </>
          )}
        </div>
      </Card>

      {/* ── Top 10 Produk Terlaris ── */}
      <Card className="flex min-h-0 flex-col p-4">
        <div className="mb-3 shrink-0 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">10 Produk Terlaris (30 hari)</h2>
          <span className="text-xs text-slate-400">Qty terjual</span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto thin-scroll">
          {top.isLoading ? (
            <Spinner label="Memuat..." />
          ) : topData.length === 0 ? (
            <EmptyState title="Belum ada penjualan" />
          ) : (
            <div className="space-y-0.5">
              {topData.map((item, idx) => (
                <ProductBar
                  key={item.product_id}
                  rank={idx + 1}
                  nama={item.nama}
                  nama_barang={item.nama_barang}
                  total_qty={item.total_qty}
                  maxQty={maxQty}
                />
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
