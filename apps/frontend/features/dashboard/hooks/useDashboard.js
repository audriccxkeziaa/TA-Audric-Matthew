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

  // Buat map pengeluaran per tanggal (YYYY-MM-DD → total nominal)
  const expenseByDate = useMemo(() => {
    const map = new Map();
    for (const r of expense.data?.data || []) {
      const key = r.tanggal?.slice(0, 10);
      if (key) map.set(key, (map.get(key) || 0) + Number(r.nominal || 0));
    }
    return map;
  }, [expense.data]);

  // 30 hari terakhir — gabungkan pendapatan, pengeluaran, pendapatan_bersih, n_tx per hari
  const combinedData = useMemo(
    () =>
      trendRaw.slice(-30).map((d) => {
        const exp = expenseByDate.get(d.date) || 0;
        return {
          date: d.date,
          label: d.date.slice(8, 10) + "/" + d.date.slice(5, 7),
          pendapatan: d.total_revenue,
          pengeluaran: exp,
          pendapatan_bersih: Math.max(0, d.total_revenue - exp),
          n_tx: d.tx_count || 0,
        };
      }),
    [trendRaw, expenseByDate]
  );

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
