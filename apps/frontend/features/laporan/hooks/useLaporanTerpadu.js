"use client";
// features/laporan/hooks/useLaporanTerpadu.js — hook master laporan terpadu:
// filter tanggal bersama + data keuangan, transaksi penjualan, dan restock.

import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  reportsApi,
  usersApi,
  expensesApi,
  purchasesApi,
  restockApi,
} from "@/lib/api";
import { downloadFile } from "@/lib/api-client";
import { useToast } from "@/hooks/useToast";
import { isoDate } from "@/lib/format";
import { groupSalesRows } from "../lib/groupRows";
import { useAuth } from "@/hooks/useAuth";

const SALES_PAGE = 10;
const RESTOCK_PAGE = 20;

export function useLaporanTerpadu() {
  const toast = useToast();
  const { user } = useAuth();
  const isKasir = user?.role === "kasir";

  // ── Filter tanggal bersama ──
  const [from, setFrom] = useState(isoDate(-30));
  const [to, setTo] = useState(isoDate(0));
  const [activeTab, setActiveTab] = useState("keuangan");
  const [printOpen, setPrintOpen] = useState(false);

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
      expensesApi.list({
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
        limit: 500,
      }),
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

  // Unified feed: pembelian supplier + pengeluaran operasional
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

    return [...purchaseEntries, ...expenseEntries].sort(
      (a, b) => new Date(b.tanggal) - new Date(a.tanggal)
    );
  }, [expensesList.data, purchasesList.data]);

  // Detail modals untuk tab keuangan
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

  useEffect(() => {
    setSalesPage(1);
  }, [activeTab, from, to, kasirFilter]);

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

  // ══════════════════════════════════════════
  // Tab 3 — Kondisi Persediaan & Stok
  // ══════════════════════════════════════════
  const restockQuery = useQuery({
    queryKey: ["restock"],
    queryFn: restockApi.list,
    staleTime: 30_000,
  });

  const allRestockItems = restockQuery.data?.data || [];
  const restockSummary = restockQuery.data?.summary || {
    total: 0,
    habis: 0,
    kritis: 0,
    menipis: 0,
  };

  const [stockFilter, setStockFilter] = useState("all");
  const [restockPage, setRestockPage] = useState(1);
  const [detailRestock, setDetailRestock] = useState(null);

  const restockItems = useMemo(() => {
    if (stockFilter === "all") return allRestockItems;
    return allRestockItems.filter((it) => it.tingkat_urgensi === stockFilter);
  }, [allRestockItems, stockFilter]);

  const restockTotalPages = Math.max(
    1,
    Math.ceil(restockItems.length / RESTOCK_PAGE)
  );
  const paginatedRestock = restockItems.slice(
    (restockPage - 1) * RESTOCK_PAGE,
    restockPage * RESTOCK_PAGE
  );

  function resetFilter() {
    setFrom(isoDate(-30));
    setTo(isoDate(0));
    setKasirFilter("");
    setSalesPage(1);
  }

  return {
    isKasir,
    // filter
    from, setFrom, to, setTo, resetFilter,
    // tabs
    activeTab, setActiveTab,
    // print modal
    printOpen, setPrintOpen,
    // tab 1 - keuangan
    financeSummary,
    fs: financeSummary.data?.data,
    unifiedRows,
    isUnifiedLoading: expensesList.isLoading || purchasesList.isLoading,
    viewExpense, setViewExpense,
    detailPurchase, setDetailPurchase, detailPurchaseLoading, openPurchaseDetail,
    // tab 2 - transaksi
    salesQuery,
    salesSummary,
    filteredSales,
    paginatedSales,
    kasirFilter, setKasirFilter,
    kasirOptions,
    salesPage, setSalesPage,
    salesTotalPages,
    salesPageSize: SALES_PAGE,
    detailData, setDetailData,
    exportCsv,
    // tab 3 - restock
    restockQuery,
    restockSummary,
    restockItems,
    paginatedRestock,
    restockPage, setRestockPage,
    restockTotalPages,
    restockPageSize: RESTOCK_PAGE,
    stockFilter, setStockFilter,
    detailRestock, setDetailRestock,
  };
}
