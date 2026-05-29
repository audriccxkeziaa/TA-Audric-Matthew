"use client";
// features/retur-stok/hooks/useReturSupplier.js — retur ke supplier:
// load semua nota, filter, pilih nota, set item retur, submit. Logika apa adanya.

import { useState, useEffect, useRef } from "react";
import { adjustmentsApi } from "@/lib/api";
import { useToast } from "@/hooks/useToast";

export function useReturSupplier() {
  const toast = useToast();
  const [notaQ, setNotaQ] = useState("");
  const [allPurchases, setAllPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [returnItems, setReturnItems] = useState([]);
  const [alasan, setAlasan] = useState("");
  const [catatan, setCatatan] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const listRef = useRef(null);

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
      toast.success(res.message || "Retur supplier berhasil.");
      setSelected(null);
      setReturnItems([]);
      setAlasan("");
      setCatatan("");
      setNotaQ("");
      const refresh = await adjustmentsApi.lookupPurchase("");
      setAllPurchases(refresh.data || []);
    } catch (err) {
      toast.error(err.message || "Gagal menyimpan retur");
    } finally {
      setSubmitting(false);
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
  };
}
