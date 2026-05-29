"use client";
// features/keuangan/hooks/useKeuangan.js — orkestrasi halaman keuangan:
// filter periode + jenis, query ringkasan/pengeluaran/penjualan/pembelian,
// hapus pengeluaran, dan pembukaan detail transaksi/nota. Perbedaan kecil
// pada parameter `to` antar query dipertahankan apa adanya.

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
  const [jenisDetail, setJenisDetail] = useState(null);

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

  const list = useQuery({
    queryKey: ["expenses", from, to, jenisFilter],
    queryFn: () =>
      expensesApi.list({
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
        ...(jenisFilter !== "all" ? { jenis: jenisFilter } : {}),
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

  const [showSales, setShowSales] = useState(false);
  const [salesPage, setSalesPage] = useState(1);
  const [detailTrx, setDetailTrx] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [showPurchases, setShowPurchases] = useState(false);
  const [purchasesPage, setPurchasesPage] = useState(1);
  const [detailPurchase, setDetailPurchase] = useState(null);
  const [detailPurchaseLoading, setDetailPurchaseLoading] = useState(false);

  const purchasesList = useQuery({
    queryKey: ["finance-purchases", from, to],
    queryFn: () =>
      purchasesApi.list({
        ...(from ? { from } : {}),
        ...(to ? { to: to + "T23:59:59.999Z" } : {}),
        limit: 500,
      }),
    enabled: showPurchases,
  });
  const purchasesRows = purchasesList.data?.data || [];

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
    // summary + expenses
    summary,
    s: summary.data?.data,
    list,
    rows: list.data?.data || [],
    // form / delete / jenis detail
    openForm, editing, openCreate, openEdit, closeForm,
    confirmDel, setConfirmDel, del,
    jenisDetail, setJenisDetail,
    // sales income
    salesList,
    salesRows: salesList.data?.data || [],
    showSales, setShowSales, salesPage, setSalesPage,
    detailTrx, setDetailTrx, detailLoading, openTrxDetail,
    // purchases
    purchasesList, purchasesRows,
    showPurchases, setShowPurchases, purchasesPage, setPurchasesPage,
    detailPurchase, setDetailPurchase, detailPurchaseLoading, openPurchaseDetail,
  };
}
