"use client";
// features/dashboard/hooks/useDashboard.js — query ringkasan + tren + top produk,
// transformasi data untuk grafik, dan kontrol modal mana yang terbuka.

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { dashboardApi, expensesApi } from "@/lib/api";

export function useDashboard() {
  const [openModal, setOpenModal] = useState(null);

  const summary = useQuery({
    queryKey: ["dash-summary"],
    queryFn: dashboardApi.summary,
  });
  const trend = useQuery({
    queryKey: ["dash-trend"],
    queryFn: () => dashboardApi.salesTrend(30),
  });

  const fromDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return d.toISOString().slice(0, 10);
  }, []);

  const expense = useQuery({
    queryKey: ["dash-expenses", fromDate],
    queryFn: () => expensesApi.list({ from: fromDate, limit: 500 }),
  });

  const top = useQuery({
    queryKey: ["dash-top"],
    queryFn: () => dashboardApi.topProducts({ days: 30, limit: 10 }),
  });

  const s = summary.data?.data;
  const trendRaw = trend.data?.data || [];

  // 30 hari terakhir — gabungkan pendapatan, pendapatan_bersih (estimasi), n_tx per hari.
  // Pengeluaran TIDAK harian → distribusi rata-rata per hari agar estimasi bersih
  // konsisten di bawah omzet dan tidak identik dengannya.
  const combinedData = useMemo(() => {
    const days = trendRaw.slice(-30);
    const totalExp = (expense.data?.data || []).reduce(
      (sum, r) => sum + Number(r.nominal || 0),
      0
    );
    const avgDailyExp = days.length > 0 ? totalExp / days.length : 0;

    return days.map((d) => ({
      date: d.date,
      label: d.date.slice(8, 10) + "/" + d.date.slice(5, 7),
      pendapatan: d.total_revenue,
      gross_profit: d.gross_profit || 0,
      pendapatan_bersih: Math.max(0, d.total_revenue - avgDailyExp),
      n_tx: d.tx_count || 0,
    }));
  }, [trendRaw, expense.data]);

  const topData = (top.data?.data || []).map((d) => ({
    ...d,
    nama:
      d.nama_barang?.length > 22
        ? d.nama_barang.slice(0, 22) + "…"
        : d.nama_barang,
  }));

  return {
    openModal,
    setOpenModal,
    summary,
    trend,
    expense,
    top,
    s,
    combinedData,
    topData,
  };
}
