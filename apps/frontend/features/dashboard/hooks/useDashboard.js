"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "@/lib/api";

export function useDashboard() {
  const [period, setPeriod] = useState("today");

  const periodParams = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const mo = now.getMonth();
    const d = now.getDate();

    if (period === "today") {
      const start = new Date(y, mo, d, 0, 0, 0, 0);
      const end   = new Date(y, mo, d, 23, 59, 59, 999);
      return { from: start.toISOString(), to: end.toISOString() };
    }
    if (period === "week") {
      const dow = now.getDay();
      const diffToMon = dow === 0 ? -6 : 1 - dow;
      const start = new Date(y, mo, d + diffToMon, 0, 0, 0, 0);
      const end   = new Date(y, mo, d + diffToMon + 6, 23, 59, 59, 999);
      return { from: start.toISOString(), to: end.toISOString() };
    }
    // month
    const start = new Date(y, mo, 1, 0, 0, 0, 0);
    const end   = new Date(y, mo + 1, 0, 23, 59, 59, 999);
    return { from: start.toISOString(), to: end.toISOString() };
  }, [period]);

  const summary = useQuery({
    queryKey: ["dash-summary", period],
    queryFn: () => dashboardApi.summary(periodParams),
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
  const trendRaw = trend.data?.data || [];

  const combinedData = useMemo(() => {
    return trendRaw.slice(-30).map((d) => ({
      date: d.date,
      label: d.date.slice(8, 10) + "/" + d.date.slice(5, 7),
      pendapatan: d.total_revenue,
      gross_profit: d.gross_profit || 0,
      n_tx: d.tx_count || 0,
    }));
  }, [trendRaw]);

  const topData = (top.data?.data || []).map((d) => ({
    ...d,
    nama:
      d.nama_barang?.length > 22
        ? d.nama_barang.slice(0, 22) + "…"
        : d.nama_barang,
  }));

  return { period, setPeriod, summary, trend, top, s, combinedData, topData };
}
