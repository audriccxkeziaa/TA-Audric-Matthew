"use client";
// features/retur-stok/hooks/useReturSupplier.js — retur ke supplier 2 tahap:
// Tahap 1 (Kirim): create → stok berkurang, status='approved' (badge: Menunggu Barang Ganti)
// Tahap 2 (Ganti): resolveSupplier → stok bertambah, status='selesai'

import { useState, useEffect, useRef } from "react";
import { useQuery, useQueries, useQueryClient } from "@tanstack/react-query";
import { adjustmentsApi } from "@/lib/api";
import { useToast } from "@/hooks/useToast";
import { printReturnReceipt } from "@/lib/receipt";

export function useReturSupplier() {
  const toast = useToast();
  const qc = useQueryClient();
  const [notaQ, setNotaQ] = useState("");
  const [allPurchases, setAllPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [returnItems, setReturnItems] = useState([]);
  const [alasan, setAlasan] = useState("");
  const [catatan, setCatatan] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resolveId, setResolveId] = useState(null);
  const [resolveTarget, setResolveTarget] = useState(null);
  const [resolveSubmitting, setResolveSubmitting] = useState(false);
  const listRef = useRef(null);

  // Retur supplier yang sudah dikirim, menunggu barang ganti (status='approved')
  const { data: pendingData, refetch: refetchPending } = useQuery({
    queryKey: ["adjustments", "return_supplier", "approved"],
    queryFn: () =>
      adjustmentsApi.list({ type: "return_supplier", status: "approved", limit: 20 }),
    refetchInterval: 30000,
  });
  const pendingReturns = pendingData?.data || [];

  // Fetch detail (dengan items) untuk setiap pending return agar bisa tampil nama barang
  const detailQueries = useQueries({
    queries: pendingReturns.map((ret) => ({
      queryKey: ["adjustment-detail", ret.id],
      queryFn: () => adjustmentsApi.get(ret.id),
      staleTime: 60_000,
    })),
  });
  const pendingWithItems = pendingReturns.map((ret, idx) => {
    const detailData = detailQueries[idx]?.data?.data;
    const refPurchaseId = detailData?.reference_purchase_id;
    const linkedPurchase = refPurchaseId
      ? allPurchases.find((p) => p.id === refPurchaseId)
      : null;
    return {
      ...ret,
      items: detailData?.items || [],
      no_nota_ref: linkedPurchase?.no_nota_supplier || null,
      supplier_name_ref: linkedPurchase?.supplier_name || null,
      reference_purchase_id: refPurchaseId || null,
    };
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await adjustmentsApi.lookupPurchase("");
        if (!cancelled) setAllPurchases(res.data || []);
      } catch (err) {
        if (!cancelled) toast.error(err.message || "Gagal memuat data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = notaQ.trim()
    ? allPurchases.filter((p) => {
        const display = (p.no_nota_supplier || "(tanpa nomor)").toLowerCase();
        return display.includes(notaQ.trim().toLowerCase());
      })
    : allPurchases;

  function handleBrowse() {
    listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function selectPurchase(p) {
    setSelected(p);
    setReturnItems(p.items.map((it) => ({ ...it, return_qty: 0, checked: false })));
  }

  function toggleItem(idx) {
    setReturnItems((prev) =>
      prev.map((it, i) =>
        i === idx
          ? { ...it, checked: !it.checked, return_qty: !it.checked ? 1 : 0 }
          : it
      )
    );
  }

  function setQty(idx, val) {
    setReturnItems((prev) =>
      prev.map((it, i) =>
        i === idx ? { ...it, return_qty: Math.max(0, Math.min(val, it.qty)) } : it
      )
    );
  }

  const checkedItems = returnItems.filter((it) => it.checked && it.return_qty > 0);

  // Tahap 1: buat dokumen retur, stok langsung berkurang
  async function handleSubmit() {
    setConfirm(false);
    setSubmitting(true);
    try {
      const res = await adjustmentsApi.create({
        type: "return_supplier",
        reference_purchase_id: selected.id,
        alasan,
        catatan: catatan || null,
        items: checkedItems.map((it) => ({
          product_id: it.product_id,
          qty: it.return_qty,
          harga_satuan: it.harga_beli,
        })),
      });
      toast.success(res.message || "Retur dikirim — menunggu barang ganti dari supplier.");
      printReturnReceipt({
        kode_adjustment: res.data?.kode_adjustment || "",
        type: "return_supplier",
        created_at: res.data?.created_at || new Date().toISOString(),
        supplier_name: selected?.supplier_name || null,
        alasan,
        items: checkedItems.map((it) => ({
          nama_barang: it.nama_barang,
          qty: it.return_qty,
          harga_satuan: it.harga_beli,
        })),
      });
      setSelected(null);
      setReturnItems([]);
      setAlasan("");
      setCatatan("");
      setNotaQ("");
      refetchPending();
      const refresh = await adjustmentsApi.lookupPurchase("");
      setAllPurchases(refresh.data || []);
    } catch (err) {
      toast.error(err.message || "Gagal menyimpan retur");
    } finally {
      setSubmitting(false);
    }
  }

  function initiateResolve(ret) {
    setResolveId(ret.id);
    setResolveTarget(ret);
  }

  // Tahap 2: barang ganti sudah datang, stok bertambah kembali + auto-print struk
  async function handleResolve() {
    if (!resolveId) return;
    setResolveSubmitting(true);
    try {
      await adjustmentsApi.resolveSupplier(resolveId);
      toast.success("Barang ganti diterima — stok sudah ditambahkan!");
      if (resolveTarget) {
        printReturnReceipt({
          kode_adjustment: resolveTarget.kode_adjustment,
          type: resolveTarget.type,
          created_at: resolveTarget.created_at,
          supplier_name: resolveTarget.supplier_name_ref || null,
          username: resolveTarget.username,
          alasan: resolveTarget.alasan,
          items: (resolveTarget.items || []).map((it) => ({
            nama_barang: it.nama_barang,
            qty: it.qty,
            harga_satuan: it.harga_satuan || it.harga_beli || 0,
          })),
        });
      }
      setResolveId(null);
      setResolveTarget(null);
      refetchPending();
      qc.invalidateQueries({ queryKey: ["adjustments"] });
    } catch (err) {
      toast.error(err.message || "Gagal menyelesaikan retur");
    } finally {
      setResolveSubmitting(false);
    }
  }

  return {
    notaQ, setNotaQ,
    loading, filtered, listRef, handleBrowse,
    selected, setSelected, selectPurchase,
    returnItems, toggleItem, setQty,
    alasan, setAlasan, catatan, setCatatan,
    confirm, setConfirm, submitting,
    checkedItems, handleSubmit,
    pendingReturns,
    pendingWithItems,
    allPurchases,
    resolveId, setResolveId,
    resolveTarget, initiateResolve,
    resolveSubmitting, handleResolve,
  };
}
