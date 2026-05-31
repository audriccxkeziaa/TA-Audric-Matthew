"use client";
// features/laporan/hooks/useLaporanTerpadu.js

import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { reportsApi, usersApi, expensesApi, purchasesApi } from "@/lib/api";
import { downloadFile } from "@/lib/api-client";
import { useToast } from "@/hooks/useToast";
import { isoDate } from "@/lib/format";
import { groupSalesRows } from "../lib/groupRows";
import { useAuth } from "@/hooks/useAuth";

const SALES_PAGE = 10;

// ── Hitung range tanggal berdasarkan preset ──
export function getPeriodRange(preset) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  if (preset === "bulan-ini")
    return {
      from: new Date(y, m, 1).toISOString().slice(0, 10),
      to: new Date(y, m + 1, 0).toISOString().slice(0, 10),
    };
  if (preset === "bulan-lalu")
    return {
      from: new Date(y, m - 1, 1).toISOString().slice(0, 10),
      to: new Date(y, m, 0).toISOString().slice(0, 10),
    };
  if (preset === "3-bulan")
    return {
      from: new Date(y, m - 2, 1).toISOString().slice(0, 10),
      to: new Date(y, m + 1, 0).toISOString().slice(0, 10),
    };
  if (preset === "tahun-ini")
    return { from: `${y}-01-01`, to: `${y}-12-31` };
  return null; // custom — jangan auto-set
}

export function useLaporanTerpadu() {
  const toast = useToast();
  const { user } = useAuth();
  const isKasir = user?.role === "kasir";

  // ── Filter periode (preset + custom range) ──
  const [periodPreset, setPeriodPreset] = useState("bulan-ini");
  const [from, setFrom] = useState(() => getPeriodRange("bulan-ini").from);
  const [to, setTo] = useState(() => getPeriodRange("bulan-ini").to);
  const [jenisFilter, setJenisFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("keuangan");
  const [printOpen, setPrintOpen] = useState(false);

  function applyPreset(preset) {
    setPeriodPreset(preset);
    if (preset !== "custom") {
      const range = getPeriodRange(preset);
      if (range) { setFrom(range.from); setTo(range.to); }
    }
  }

  // ══════════════════════════════════════════
  // Tab 1 — Ringkasan & Keuangan
  // ══════════════════════════════════════════
  const financeSummary = useQuery({
    queryKey: ["finance-summary", from, to],
    queryFn: () =>
      expensesApi.summary({
        ...(from ? { from } : {}),
        ...(to ? { to: to + "T23:59:59.999Z" } : {}),
      }),
  });

  const expensesList = useQuery({
    queryKey: ["expenses", from, to],
    queryFn: () =>
      expensesApi.list({ ...(from ? { from } : {}), ...(to ? { to } : {}), limit: 500 }),
  });

  const purchasesList = useQuery({
    queryKey: ["finance-purchases", from, to],
    queryFn: () =>
      purchasesApi.list({
        ...(from ? { from } : {}),
        ...(to ? { to: to + "T23:59:59.999Z" } : {}),
        limit: 500,
      }),
  });

  // Unified feed dengan jenisFilter client-side
  const unifiedRows = useMemo(() => {
    const allExpenses = expensesList.data?.data || [];
    const allPurchases = purchasesList.data?.data || [];

    const purchaseEntries = allPurchases.map((p) => ({
      id: `purchase-${p.id}`,
      _type: "purchase",
      _rawId: p.id,
      tanggal: p.created_at,
      jenis: "pembelian_supplier",
      deskripsi: p.supplier_name || p.no_nota_supplier || "-",
      username: "-",
      nominal: p.total || 0,
    }));

    const expenseEntries = allExpenses.map((e) => ({
      id: `expense-${e.id}`,
      _type: "expense",
      _rawId: e.id,
      _raw: e,
      tanggal: e.tanggal,
      jenis: e.jenis,
      deskripsi: e.deskripsi,
      username: e.username || "-",
      nominal: e.nominal || 0,
    }));

    const merged = [...purchaseEntries, ...expenseEntries].sort(
      (a, b) => new Date(b.tanggal) - new Date(a.tanggal)
    );

    if (jenisFilter === "all") return merged;
    return merged.filter((r) => r.jenis === jenisFilter);
  }, [expensesList.data, purchasesList.data, jenisFilter]);

  const [viewExpense, setViewExpense] = useState(null);
  const [detailPurchase, setDetailPurchase] = useState(null);
  const [detailPurchaseLoading, setDetailPurchaseLoading] = useState(false);

  async function openPurchaseDetail(id) {
    setDetailPurchaseLoading(true);
    try {
      const res = await purchasesApi.get(id);
      setDetailPurchase(res.data);
    } catch {
      setDetailPurchase(null);
    } finally {
      setDetailPurchaseLoading(false);
    }
  }

  // ══════════════════════════════════════════
  // Tab 2 — Riwayat Transaksi Penjualan
  // ══════════════════════════════════════════
  const salesQuery = useQuery({
    queryKey: ["laporan", "penjualan", from, to],
    queryFn: () => reportsApi.sales({ from, to }),
  });

  const salesRaw = salesQuery.data?.data || [];
  const salesSummary = salesQuery.data?.summary || {};
  const salesGrouped = useMemo(() => groupSalesRows(salesRaw), [salesRaw]);

  const [kasirFilter, setKasirFilter] = useState("");
  const [salesPage, setSalesPage] = useState(1);
  const [detailData, setDetailData] = useState(null);

  const { data: usersData } = useQuery({
    queryKey: ["users-list"],
    queryFn: usersApi.list,
    staleTime: 5 * 60_000,
    enabled: !isKasir,
  });

  const kasirOptions = useMemo(() => {
    const fromApi = (usersData?.data || [])
      .filter((u) => u.role === "kasir")
      .map((u) => u.username)
      .filter(Boolean);
    const fromData = salesGrouped.map((g) => g.kasir).filter(Boolean);
    return [...new Set([...fromApi, ...fromData])].sort();
  }, [usersData, salesGrouped]);

  const filteredSales = useMemo(() => {
    if (!kasirFilter) return salesGrouped;
    return salesGrouped.filter((g) => g.kasir === kasirFilter);
  }, [salesGrouped, kasirFilter]);

  const salesTotalPages = Math.max(1, Math.ceil(filteredSales.length / SALES_PAGE));
  const paginatedSales = filteredSales.slice(
    (salesPage - 1) * SALES_PAGE,
    salesPage * SALES_PAGE
  );

  useEffect(() => { setSalesPage(1); }, [activeTab, from, to, kasirFilter]);

  async function exportCsv() {
    try {
      await downloadFile("/reports/sales", {
        query: { from, to, format: "csv" },
        filename: `laporan-penjualan_${from}_${to}.csv`,
      });
      toast.success("CSV diunduh");
    } catch (e) {
      toast.error(e.message || "Gagal mengunduh CSV");
    }
  }

  function resetFilter() {
    applyPreset("bulan-ini");
    setKasirFilter("");
    setJenisFilter("all");
    setSalesPage(1);
  }

  return {
    isKasir,
    // periode
    periodPreset, applyPreset,
    from, setFrom, to, setTo,
    jenisFilter, setJenisFilter,
    resetFilter,
    // tabs
    activeTab, setActiveTab,
    // print
    printOpen, setPrintOpen,
    // tab 1
    financeSummary,
    fs: financeSummary.data?.data,
    unifiedRows,
    isUnifiedLoading: expensesList.isLoading || purchasesList.isLoading,
    viewExpense, setViewExpense,
    detailPurchase, setDetailPurchase, detailPurchaseLoading, openPurchaseDetail,
    // tab 2
    salesQuery,
    salesSummary,
    salesGrouped,
    filteredSales,
    paginatedSales,
    kasirFilter, setKasirFilter,
    kasirOptions,
    salesPage, setSalesPage,
    salesTotalPages,
    salesPageSize: SALES_PAGE,
    detailData, setDetailData,
    exportCsv,
  };
}
