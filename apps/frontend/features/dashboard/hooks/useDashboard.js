"use client";
// features/dashboard/hooks/useDashboard.js — query ringkasan + tren + top produk,
// transformasi data untuk grafik, dan kontrol modal mana yang terbuka.

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "@/lib/api";

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
  const top = useQuery({
    queryKey: ["dash-top"],
    queryFn: () => dashboardApi.topProducts({ days: 30, limit: 10 }),
  });

  const s = summary.data?.data;
  const trendRaw = trend.data?.data || [];
  const trendData = trendRaw
    .filter((d) => d.total_revenue > 0)
    .slice(-7)
    .map((d) => ({
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

  return {
    openModal,
    setOpenModal,
    summary,
    trend,
    top,
    s,
    trendData,
    topData,
  };
}
