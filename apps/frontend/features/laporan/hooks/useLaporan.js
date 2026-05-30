"use client";
// features/laporan/hooks/useLaporan.js — laporan penjualan/pembelian:
// tab aktif, filter periode + kasir, grouping, paging client-side, export CSV.

import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { reportsApi, usersApi } from "@/lib/api";
import { downloadFile } from "@/lib/api-client";
import { useToast } from "@/hooks/useToast";
import { isoDate } from "@/lib/format";
import { groupSalesRows, groupPurchaseRows } from "../lib/groupRows";
import { useAuth } from "@/hooks/useAuth";

export const PAGE_SIZE = 10;

export function useLaporan() {
  const toast = useToast();
  const { user } = useAuth();
  const isKasir = user?.role === "kasir";
  const [tab, setTab] = useState("penjualan");
  const [from, setFrom] = useState(isoDate(-30));
  const [to, setTo] = useState(isoDate(0));
  const [kasirFilter, setKasirFilter] = useState("");
  const [page, setPage] = useState(1);
  const [detailData, setDetailData] = useState(null); // grouped object with items[]

  const isSales = tab === "penjualan";
  const query = { from, to };

  // Reset page & kasir filter when tab or date changes
  useEffect(() => {
    setPage(1);
    setKasirFilter("");
  }, [tab, from, to]);

  const { data, isLoading } = useQuery({
    queryKey: ["laporan", tab, from, to],
    queryFn: () =>
      isSales ? reportsApi.sales(query) : reportsApi.purchases(query),
  });
  const rawRows = data?.data || [];
  const summary = data?.summary || {};

  const grouped = useMemo(
    () => (isSales ? groupSalesRows(rawRows) : groupPurchaseRows(rawRows)),
    [rawRows, isSales]
  );

  // Ambil daftar user dari API agar semua kasir tampil meski belum transaksi.
  const { data: usersData } = useQuery({
    queryKey: ["users-list"],
    queryFn: usersApi.list,
    staleTime: 5 * 60 * 1000,
    enabled: !isKasir, // /api/users adalah admin-only; kasir pakai data dari grouped saja
  });
  const kasirOptions = useMemo(() => {
    const allUsers = usersData?.data || [];
    // Sales tab → filter kasir; Purchase tab → semua user yg pernah input
    const fromApi = allUsers
      .filter((u) => (isSales ? u.role === "kasir" : true))
      .map((u) => u.username)
      .filter(Boolean);
    // Gabung dengan yang ada di data (jaga-jaga user sudah dihapus tapi transaksinya masih ada)
    const fromData = grouped
      .map((g) => (isSales ? g.kasir : g.user))
      .filter(Boolean);
    return [...new Set([...fromApi, ...fromData])].sort();
  }, [usersData, grouped, isSales]);

  // Filter by kasir
  const filteredGrouped = useMemo(() => {
    if (!kasirFilter) return grouped;
    return grouped.filter((g) =>
      isSales ? g.kasir === kasirFilter : g.user === kasirFilter
    );
  }, [grouped, kasirFilter, isSales]);

  // Paginate
  const totalPages = Math.max(1, Math.ceil(filteredGrouped.length / PAGE_SIZE));
  const paginatedGrouped = filteredGrouped.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  async function exportCsv() {
    try {
      await downloadFile(isSales ? "/reports/sales" : "/reports/purchases", {
        query: { ...query, format: "csv" },
        filename: `laporan-${tab}_${isoDate()}.csv`,
      });
      toast.success("CSV diunduh");
    } catch (e) {
      toast.error(e.message || "Gagal mengunduh CSV");
    }
  }

  function changeTab(next) {
    if (isKasir && next === "pembelian") return; // kasir tidak boleh akses tab pembelian
    setTab(next);
    setDetailData(null);
  }

  function resetFilter() {
    setKasirFilter("");
    setFrom(isoDate(-30));
    setTo(isoDate(0));
    setPage(1);
  }

  return {
    isKasir,
    tab,
    changeTab,
    isSales,
    from,
    setFrom,
    to,
    setTo,
    kasirFilter,
    setKasirFilter,
    kasirOptions,
    page,
    setPage,
    pageSize: PAGE_SIZE,
    detailData,
    setDetailData,
    isLoading,
    summary,
    filteredGrouped,
    paginatedGrouped,
    totalPages,
    exportCsv,
    resetFilter,
  };
}
