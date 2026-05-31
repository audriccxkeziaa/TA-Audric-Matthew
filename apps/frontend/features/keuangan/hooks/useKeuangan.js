"use client";
// features/keuangan/hooks/useKeuangan.js — orkestrasi halaman keuangan:
// filter periode + jenis, query ringkasan/pengeluaran/penjualan/pembelian,
// hapus pengeluaran, detail transaksi/nota, dan unified pengeluaran feed.

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { expensesApi, salesApi, purchasesApi } from "@/lib/api";
import { useToast } from "@/hooks/useToast";

export function useKeuangan() {
  const qc = useQueryClient();
  const toast = useToast();

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [jenisFilter, setJenisFilter] = useState("all");
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [activeTab, setActiveTab] = useState("pemasukan");

  const params = useMemo(() => {
    const p = {};
    if (from) p.from = from;
    if (to) p.to = to + "T23:59:59.999Z";
    return p;
  }, [from, to]);

  const summary = useQuery({
    queryKey: ["finance-summary", from, to],
    queryFn: () => expensesApi.summary(params),
  });

  // Fetch semua expenses — filter jenis dilakukan client-side di unifiedRows
  const list = useQuery({
    queryKey: ["expenses", from, to],
    queryFn: () =>
      expensesApi.list({
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
        limit: 500,
      }),
  });

  const del = useMutation({
    mutationFn: (id) => expensesApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["finance-summary"] });
      toast.success("Pengeluaran Operasional berhasil dihapus.");
      setConfirmDel(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const salesList = useQuery({
    queryKey: ["finance-sales", from, to],
    queryFn: () =>
      salesApi.list({
        ...(from ? { from } : {}),
        ...(to ? { to: to + "T23:59:59.999Z" } : {}),
        limit: 500,
      }),
  });

  // Purchases selalu di-fetch (dulu lazy via enabled:showPurchases)
  const purchasesList = useQuery({
    queryKey: ["finance-purchases", from, to],
    queryFn: () =>
      purchasesApi.list({
        ...(from ? { from } : {}),
        ...(to ? { to: to + "T23:59:59.999Z" } : {}),
        limit: 500,
      }),
  });

  const [detailTrx, setDetailTrx] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailPurchase, setDetailPurchase] = useState(null);
  const [detailPurchaseLoading, setDetailPurchaseLoading] = useState(false);

  // Unified feed: gabung purchases + expenses, sort by date desc, filter client-side
  const unifiedRows = useMemo(() => {
    const allExpenses = list.data?.data || [];
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
  }, [list.data, purchasesList.data, jenisFilter]);

  async function openTrxDetail(id) {
    setDetailLoading(true);
    try {
      const res = await salesApi.get(id);
      setDetailTrx(res.data);
    } catch {
      setDetailTrx(null);
    } finally {
      setDetailLoading(false);
    }
  }

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

  function resetFilter() {
    setFrom("");
    setTo("");
    setJenisFilter("all");
  }

  function openCreate() {
    setEditing(null);
    setOpenForm(true);
  }

  function openEdit(row) {
    setEditing(row);
    setOpenForm(true);
  }

  function closeForm() {
    setOpenForm(false);
    setEditing(null);
  }

  return {
    // filter
    from, setFrom, to, setTo, jenisFilter, setJenisFilter, resetFilter,
    // tabs
    activeTab, setActiveTab,
    // summary + expenses
    summary,
    s: summary.data?.data,
    list,
    rows: list.data?.data || [],
    // form / delete
    openForm, editing, openCreate, openEdit, closeForm,
    confirmDel, setConfirmDel, del,
    // sales income
    salesList,
    salesRows: salesList.data?.data || [],
    detailTrx, setDetailTrx, detailLoading, openTrxDetail,
    // purchases + unified pengeluaran
    purchasesList,
    unifiedRows,
    isUnifiedLoading: list.isLoading || purchasesList.isLoading,
    detailPurchase, setDetailPurchase, detailPurchaseLoading, openPurchaseDetail,
  };
}
