"use client";
// =================================================================
// /dashboard — Dashboard Analitik Admin (single-viewport, interaktif)
// =================================================================
// - 5 kartu metrik (Transaksi, Revenue, Stok Masuk, Stok Menipis, Stok
//   Negatif). SEMUA bisa diklik → popup detail terkait.
// - Heatmap stok menipis pindah ke popup yang dipicu kartu "Stok Menipis"
//   sehingga halaman utama bebas scroll.
// - Dua grafik (tren penjualan & top produk) menempati sisa tinggi viewport.
// =================================================================

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  dashboardApi,
  salesApi,
  purchasesApi,
  productsApi,
} from "@/lib/api";
import { rupiah, angka } from "@/lib/format";
import {
  PageShell,
  PageHeader,
  Card,
  StatCard,
  Modal,
  Spinner,
  EmptyState,
  Badge,
} from "@/components/ui";

// Helper tanggal — hari ini & 7 hari lalu (ISO).
function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { from: start.toISOString(), to: end.toISOString() };
}
function last7DaysRange() {
  const start = new Date();
  start.setDate(start.getDate() - 7);
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  return { from: start.toISOString(), to: end.toISOString() };
}
function jam(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}
function tanggal(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Warna kotak heatmap sesuai level kekritisan stok.
function heatColor(level) {
  if (level === "out") return "bg-red-600 text-white";
  if (level === "low") return "bg-amber-500 text-white";
  return "bg-yellow-300 text-slate-800";
}

// ---------- Pembungkus StatCard yang clickable ----------
function ClickableStat({ label, value, hint, tone, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group rounded-xl text-left transition focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <div className="rounded-xl transition group-hover:-translate-y-0.5 group-hover:shadow-md">
        <StatCard label={label} value={value} hint={hint} tone={tone} />
      </div>
    </button>
  );
}

// =================================================================
// Modal detail per metric
// =================================================================

function SalesTodayModal({ open, onClose }) {
  const range = useMemo(() => todayRange(), []);
  const q = useQuery({
    queryKey: ["sales-today", range.from],
    queryFn: () => salesApi.list({ from: range.from, to: range.to, limit: 200 }),
    enabled: open,
  });
  const rows = q.data?.data || [];
  const total = rows.reduce((acc, r) => acc + Number(r.total_harga || 0), 0);
  const avg = rows.length ? total / rows.length : 0;

  return (
    <Modal open={open} onClose={onClose} title="Detail Transaksi Hari Ini" width="max-w-3xl">
      {q.isLoading ? (
        <Spinner label="Memuat transaksi..." />
      ) : (
        <>
          <div className="mb-3 grid grid-cols-3 gap-3">
            <StatCard label="Jumlah Transaksi" value={angka(rows.length)} />
            <StatCard label="Total Revenue" value={rupiah(total)} tone="good" />
            <StatCard label="Rata-rata / Transaksi" value={rupiah(avg)} />
          </div>
          {rows.length === 0 ? (
            <EmptyState title="Belum ada transaksi hari ini" />
          ) : (
            <div className="max-h-80 overflow-auto thin-scroll rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Waktu</th>
                    <th className="px-3 py-2">Kode Transaksi</th>
                    <th className="px-3 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-mono text-xs">{jam(r.created_at)}</td>
                      <td className="px-3 py-2 font-mono text-xs">{r.kode_transaksi}</td>
                      <td className="px-3 py-2 text-right font-semibold">
                        {rupiah(r.total_harga)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

function StockInModal({ open, onClose }) {
  const range = useMemo(() => last7DaysRange(), []);
  const q = useQuery({
    queryKey: ["purchases-7d", range.from],
    queryFn: () => purchasesApi.list({ from: range.from, to: range.to, limit: 100 }),
    enabled: open,
  });
  const rows = (q.data?.data || []).filter((p) => p.status_validasi === "tervalidasi");
  const total = rows.reduce((acc, r) => acc + Number(r.total || 0), 0);

  return (
    <Modal open={open} onClose={onClose} title="Detail Stok Masuk (7 Hari Terakhir)" width="max-w-3xl">
      {q.isLoading ? (
        <Spinner label="Memuat..." />
      ) : (
        <>
          <div className="mb-3 grid grid-cols-2 gap-3">
            <StatCard label="Jumlah Nota Tervalidasi" value={angka(rows.length)} />
            <StatCard label="Total Nilai Pembelian" value={rupiah(total)} tone="good" />
          </div>
          {rows.length === 0 ? (
            <EmptyState
              title="Belum ada stok masuk"
              description="Belum ada nota supplier yang tervalidasi dalam 7 hari terakhir."
            />
          ) : (
            <div className="max-h-80 overflow-auto thin-scroll rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Tanggal</th>
                    <th className="px-3 py-2">No. Nota</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-xs">{tanggal(r.created_at)}</td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {r.no_nota_supplier || "—"}
                      </td>
                      <td className="px-3 py-2">
                        <Badge tone="green">{r.status_validasi}</Badge>
                      </td>
                      <td className="px-3 py-2 text-right font-semibold">
                        {rupiah(r.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

function LowStockHeatmapModal({ open, onClose }) {
  const q = useQuery({
    queryKey: ["dash-low"],
    queryFn: dashboardApi.lowStock,
    enabled: open,
  });
  const items = q.data?.data || [];
  const habis = items.filter((p) => p.level === "out").length;
  const low = items.filter((p) => p.level === "low").length;
  const warn = items.filter((p) => p.level === "warning").length;

  return (
    <Modal open={open} onClose={onClose} title="Heatmap Stok Menipis" width="max-w-5xl">
      {q.isLoading ? (
        <Spinner label="Memuat heatmap..." />
      ) : items.length === 0 ? (
        <EmptyState
          title="Semua stok aman"
          description="Tidak ada barang aktif di bawah ambang minimum."
        />
      ) : (
        <>
          <div className="mb-3 grid grid-cols-3 gap-3">
            <StatCard label="Stok Habis" value={angka(habis)} tone="bad" />
            <StatCard label="Di bawah min" value={angka(low)} tone="warn" />
            <StatCard label="Mendekati min" value={angka(warn)} />
          </div>
          <div className="mb-3 flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <span className="h-3 w-3 rounded bg-red-600" /> Habis
            </span>
            <span className="flex items-center gap-1">
              <span className="h-3 w-3 rounded bg-amber-500" /> Di bawah min
            </span>
            <span className="flex items-center gap-1">
              <span className="h-3 w-3 rounded bg-yellow-300" /> Mendekati min
            </span>
          </div>
          <div className="max-h-[60vh] overflow-auto thin-scroll">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {items.map((p) => (
                <div
                  key={p.id}
                  title={`${p.nama_barang} — stok ${p.stok}/${p.min_stock}`}
                  className={`rounded-lg p-2.5 ${heatColor(p.level)}`}
                >
                  <p className="truncate text-xs font-semibold">{p.nama_barang}</p>
                  <p className="truncate text-[10px] opacity-80">{p.kode_barang}</p>
                  <p className="mt-1 text-sm font-bold">
                    {angka(p.stok)}
                    <span className="text-[10px] font-normal opacity-80">
                      {" "}
                      / {angka(p.min_stock)}
                    </span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}

function NegativeStockModal({ open, onClose, count }) {
  // Hanya fetch list bila count > 0 — kalau 0 tampilkan pesan sukses.
  const q = useQuery({
    queryKey: ["products-negative"],
    queryFn: () => productsApi.list({ limit: 200, status: "all" }),
    enabled: open && count > 0,
  });
  const rows = (q.data?.data || []).filter((p) => Number(p.stok) < 0);

  return (
    <Modal open={open} onClose={onClose} title="Detail Stok Negatif" width="max-w-2xl">
      {count === 0 ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 text-center">
          <div className="mx-auto mb-2 text-3xl">✓</div>
          <p className="text-base font-semibold text-emerald-700">
            Tidak ada stok negatif
          </p>
          <p className="mt-1 text-sm text-emerald-600">
            Bukti aturan <b>R1</b> (Pencegahan Stok Negatif) dan <b>R3</b>{" "}
            (Pembaruan Stok Terpusat) berhasil menjaga integritas data.
          </p>
        </div>
      ) : q.isLoading ? (
        <Spinner label="Memuat data..." />
      ) : rows.length === 0 ? (
        <EmptyState title="Stok negatif sudah teratasi" />
      ) : (
        <div className="rounded-lg border border-red-200 bg-red-50">
          <div className="border-b border-red-200 px-4 py-2 text-sm font-semibold text-red-700">
            ⚠ {rows.length} barang memiliki stok negatif — segera diinvestigasi
          </div>
          <table className="w-full text-sm">
            <thead className="bg-red-100/50 text-left text-xs uppercase text-red-700">
              <tr>
                <th className="px-3 py-2">Kode</th>
                <th className="px-3 py-2">Nama Barang</th>
                <th className="px-3 py-2 text-right">Stok</th>
                <th className="px-3 py-2 text-right">Min</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-red-100">
              {rows.map((p) => (
                <tr key={p.id}>
                  <td className="px-3 py-2 font-mono text-xs">{p.kode_barang}</td>
                  <td className="px-3 py-2">{p.nama_barang}</td>
                  <td className="px-3 py-2 text-right font-bold text-red-700">
                    {angka(p.stok)}
                  </td>
                  <td className="px-3 py-2 text-right">{angka(p.min_stock)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

// =================================================================
// Page
// =================================================================
export default function DashboardPage() {
  const [openModal, setOpenModal] = useState(null);

  const summary = useQuery({
    queryKey: ["dash-summary"],
    queryFn: dashboardApi.summary,
  });
  const trend = useQuery({
    queryKey: ["dash-trend"],
    queryFn: () => dashboardApi.salesTrend(30),
  });
  const top = useQuery({
    queryKey: ["dash-top"],
    queryFn: () => dashboardApi.topProducts({ days: 30, limit: 10 }),
  });

  const s = summary.data?.data;
  const trendData = (trend.data?.data || []).map((d) => ({
    ...d,
    label: d.date.slice(8, 10) + "/" + d.date.slice(5, 7),
  }));
  const topData = (top.data?.data || []).map((d) => ({
    ...d,
    nama:
      d.nama_barang?.length > 22
        ? d.nama_barang.slice(0, 22) + "…"
        : d.nama_barang,
  }));

  return (
    <PageShell>
      <PageHeader
        title="Dashboard"
        description="Ringkasan operasional toko & analitik penjualan. Klik kartu mana saja untuk detail."
      />

      {/* Kartu metrik — clickable */}
      {summary.isLoading ? (
        <Card className="shrink-0 p-6">
          <Spinner label="Memuat ringkasan..." />
        </Card>
      ) : (
        <div className="grid shrink-0 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <ClickableStat
            label="Transaksi Hari Ini"
            value={angka(s?.tx_today_count || 0)}
            hint="klik untuk detail"
            onClick={() => setOpenModal("sales")}
          />
          <ClickableStat
            label="Revenue Hari Ini"
            value={rupiah(s?.revenue_today || 0)}
            tone="good"
            hint="klik untuk detail"
            onClick={() => setOpenModal("sales")}
          />
          <ClickableStat
            label="Stok Masuk (7 hari)"
            value={angka(s?.stock_in_week || 0)}
            hint="unit tervalidasi · klik untuk detail"
            onClick={() => setOpenModal("stock-in")}
          />
          <ClickableStat
            label="Stok Menipis"
            value={angka(s?.low_stock_count || 0)}
            tone="warn"
            hint="klik untuk heatmap"
            onClick={() => setOpenModal("low-stock")}
          />
          <ClickableStat
            label="Stok Negatif"
            value={angka(s?.negative_stock_count || 0)}
            tone={s?.negative_stock_count ? "bad" : "good"}
            hint="target 0 — bukti R1+R3"
            onClick={() => setOpenModal("negative")}
          />
        </div>
      )}

      {s?.r1_rejected_today > 0 && (
        <p className="mt-2 shrink-0 text-xs text-slate-500">
          R1 menolak {s.r1_rejected_today} percobaan transaksi stok kurang
          hari ini — semua tercatat di audit trail.
        </p>
      )}

      {/* Grafik — isi sisa tinggi viewport, tanpa scroll halaman */}
      <div className="mt-3 grid min-h-0 flex-1 gap-3 lg:grid-cols-2">
        <Card className="flex min-h-0 flex-col p-4">
          <h2 className="mb-2 shrink-0 font-semibold text-slate-800">
            Tren Penjualan Harian (30 hari)
          </h2>
          <div className="min-h-0 flex-1">
            {trend.isLoading ? (
              <Spinner label="Memuat..." />
            ) : trendData.length === 0 ? (
              <EmptyState title="Belum ada data penjualan" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" fontSize={11} />
                  <YAxis
                    fontSize={11}
                    tickFormatter={(v) => "Rp" + (v / 1000).toFixed(0) + "k"}
                  />
                  <Tooltip
                    formatter={(v, name) =>
                      name === "total_revenue"
                        ? [rupiah(v), "Revenue"]
                        : [v, "Transaksi"]
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="total_revenue"
                    stroke="#4f46e5"
                    strokeWidth={2}
                    dot={false}
                    name="total_revenue"
                  />
                </LineChart>
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

      {/* Modals */}
      <SalesTodayModal
        open={openModal === "sales"}
        onClose={() => setOpenModal(null)}
      />
      <StockInModal
        open={openModal === "stock-in"}
        onClose={() => setOpenModal(null)}
      />
      <LowStockHeatmapModal
        open={openModal === "low-stock"}
        onClose={() => setOpenModal(null)}
      />
      <NegativeStockModal
        open={openModal === "negative"}
        onClose={() => setOpenModal(null)}
        count={s?.negative_stock_count || 0}
      />
    </PageShell>
  );
}
