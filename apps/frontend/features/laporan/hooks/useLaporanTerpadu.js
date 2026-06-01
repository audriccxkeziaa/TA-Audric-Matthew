"use client";
// features/laporan/hooks/useLaporanTerpadu.js

import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { reportsApi, usersApi, expensesApi, purchasesApi, adjustmentsApi } from "@/lib/api";
import { downloadFile } from "@/lib/api-client";
import { useToast } from "@/hooks/useToast";
import { groupSalesRows } from "../lib/groupRows";
import { useAuth } from "@/hooks/useAuth";

const EXPENSE_PAGE = 10;

// Format date as YYYY-MM-DD using local timezone (avoids UTC offset bug)
function localDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Build timezone-aware ISO for timestamp-based API filters (sales, purchases).
// Sends e.g. "2026-06-01T00:00:00.000+08:00" so Supabase/PG filters correctly
// in local time — plain "2026-06-01" would be cast as UTC midnight (wrong for WITA).
function tzOffset() {
  const off = -(new Date().getTimezoneOffset()); // positive for UTC+ zones
  const sign = off >= 0 ? "+" : "-";
  const hh = String(Math.floor(Math.abs(off) / 60)).padStart(2, "0");
  const mm = String(Math.abs(off) % 60).padStart(2, "0");
  return `${sign}${hh}:${mm}`;
}
function toLocalISOStart(dateStr) {
  if (!dateStr) return undefined;
  return `${dateStr}T00:00:00.000${tzOffset()}`;
}
function toLocalISOEnd(dateStr) {
  if (!dateStr) return undefined;
  return `${dateStr}T23:59:59.999${tzOffset()}`;
}

// ── Hitung range tanggal berdasarkan preset ──
export function getPeriodRange(preset) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  if (preset === "bulan-ini")
    return {
      from: localDate(new Date(y, m, 1)),
      to: localDate(new Date(y, m + 1, 0)),
    };
  if (preset === "bulan-lalu")
    return {
      from: localDate(new Date(y, m - 1, 1)),
      to: localDate(new Date(y, m, 0)),
    };
  if (preset === "3-bulan")
    return {
      from: localDate(new Date(y, m - 2, 1)),
      to: localDate(new Date(y, m + 1, 0)),
    };
  if (preset === "6-bulan")
    return {
      from: localDate(new Date(y, m - 5, 1)),
      to: localDate(new Date(y, m + 1, 0)),
    };
  if (preset === "tahun-ini")
    return { from: `${y}-01-01`, to: `${y}-12-31` };
  if (preset === "tahun-lalu")
    return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
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
        ...(from ? { from: toLocalISOStart(from) } : {}),
        ...(to ? { to: toLocalISOEnd(to) } : {}),
      }),
  });

  // Expenses use DATE column (tanggal) — plain date strings are correct here
  const expensesList = useQuery({
    queryKey: ["expenses", from, to],
    queryFn: () =>
      expensesApi.list({ ...(from ? { from } : {}), ...(to ? { to } : {}), limit: 500 }),
  });

  const purchasesList = useQuery({
    queryKey: ["finance-purchases", from, to],
    queryFn: () =>
      purchasesApi.list({
        ...(from ? { from: toLocalISOStart(from) } : {}),
        ...(to ? { to: toLocalISOEnd(to) } : {}),
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

    const expenseEntries = allExpenses.map((e) => {
      // Data lama: backend menyimpan refund retur dengan jenis "custom".
      // Normalisasi ke "refund_pelanggan" agar label & filter laporan benar.
      const isLegacyRetur =
        e.jenis === "custom" &&
        e.deskripsi?.toLowerCase().startsWith("refund retur");
      return {
        id: `expense-${e.id}`,
        _type: "expense",
        _rawId: e.id,
        _raw: e,
        tanggal: e.tanggal,
        jenis: isLegacyRetur ? "refund_pelanggan" : e.jenis,
        deskripsi: e.deskripsi,
        username: e.username || "-",
        nominal: e.nominal || 0,
      };
    });

    const merged = [...purchaseEntries, ...expenseEntries].sort(
      (a, b) => new Date(b.tanggal) - new Date(a.tanggal)
    );

    if (jenisFilter === "all") return merged;
    return merged.filter((r) => r.jenis === jenisFilter);
  }, [expensesList.data, purchasesList.data, jenisFilter]);

  const [expensePage, setExpensePage] = useState(1);
  const expenseTotalPages = Math.max(1, Math.ceil(unifiedRows.length / EXPENSE_PAGE));
  const paginatedUnifiedRows = unifiedRows.slice(
    (expensePage - 1) * EXPENSE_PAGE,
    expensePage * EXPENSE_PAGE
  );

  useEffect(() => { setExpensePage(1); }, [from, to, jenisFilter]);

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
  // Rincian Pemasukan — Riwayat Penjualan
  // ══════════════════════════════════════════
  const salesQuery = useQuery({
    queryKey: ["laporan", "penjualan", from, to],
    queryFn: () => reportsApi.sales({ from: toLocalISOStart(from), to: toLocalISOEnd(to) }),
  });

  const salesRaw = salesQuery.data?.data || [];
  const salesSummary = salesQuery.data?.summary || {};
  const salesGrouped = useMemo(() => groupSalesRows(salesRaw), [salesRaw]);

  const [kasirFilter, setKasirFilter] = useState("");
  const [detailData, setDetailData] = useState(null);
  // Map product_id → returned_qty untuk detail sale yang sedang dibuka
  const [saleReturMap, setSaleReturMap] = useState(new Map());

  async function openSaleDetail(g) {
    setDetailData(g);
    setSaleReturMap(new Map());
    try {
      const res = await adjustmentsApi.returnsForSale(g.sale_id);
      const m = new Map((res.data || []).map((r) => [r.product_id, r.returned_qty]));
      setSaleReturMap(m);
    } catch {
      // non-critical — tetap tampilkan detail tanpa badge retur
    }
  }

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
    setExpensePage(1);
  }

  return {
    isKasir,
    // periode
    periodPreset, applyPreset,
    from, setFrom, to, setTo,
    jenisFilter, setJenisFilter,
    resetFilter,
    // print
    printOpen, setPrintOpen,
    // keuangan summary
    financeSummary,
    fs: financeSummary.data?.data,
    unifiedRows,
    paginatedUnifiedRows,
    expensePage, setExpensePage,
    expenseTotalPages,
    expensePageSize: EXPENSE_PAGE,
    isUnifiedLoading: expensesList.isLoading || purchasesList.isLoading,
    viewExpense, setViewExpense,
    detailPurchase, setDetailPurchase, detailPurchaseLoading, openPurchaseDetail,
    // rincian pemasukan
    salesQuery,
    salesSummary,
    salesGrouped,
    filteredSales,
    kasirFilter, setKasirFilter,
    kasirOptions,
    detailData, setDetailData, openSaleDetail, saleReturMap,
    exportCsv,
  };
}
