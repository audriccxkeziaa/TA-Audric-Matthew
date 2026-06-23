"use client";
// features/retur-stok/hooks/useReturPelanggan.js — retur pelanggan + manager
// override (approve via PIN admin atau remote).
// Aturan baku: semua item diasumsikan kondisi 'bagus' → stok bertambah,
// refund dicatat ke expenses oleh backend.

import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adjustmentsApi } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";

export function useReturPelanggan() {
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [kodeQ, setKodeQ] = useState("");
  const [allSales, setAllSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [returnItems, setReturnItems] = useState([]);
  const [alasan, setAlasan] = useState("");
  const [catatan, setCatatan] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const listRef = useRef(null);

  // Manager Override state
  const [overrideData, setOverrideData] = useState(null);
  const [pinUsername, setPinUsername] = useState("");
  const [pinPassword, setPinPassword] = useState("");
  const [pinSubmitting, setPinSubmitting] = useState(false);
  const [pinError, setPinError] = useState("");

  const { data: pendingDetail } = useQuery({
    queryKey: ["adjustments", overrideData?.adjustmentId],
    queryFn: () => adjustmentsApi.get(overrideData.adjustmentId),
    enabled: !!overrideData?.adjustmentId,
    refetchInterval: 3000,
  });

  useEffect(() => {
    if (pendingDetail?.data?.status === "approved" && overrideData) {
      toast.success("Retur pelanggan telah disetujui oleh admin!");
      setOverrideData(null);
      resetForm();
      qc.invalidateQueries({ queryKey: ["adjustments"] });
      qc.invalidateQueries({ queryKey: ["notif-pending-approval"] });
    } else if (pendingDetail?.data?.status === "rejected" && overrideData) {
      toast.error("Retur pelanggan ditolak oleh admin.");
      setOverrideData(null);
      resetForm();
      qc.invalidateQueries({ queryKey: ["adjustments"] });
      qc.invalidateQueries({ queryKey: ["notif-pending-approval"] });
    }
  }, [pendingDetail?.data?.status]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await adjustmentsApi.lookupSale("");
        if (!cancelled) setAllSales(res.data || []);
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

  const filtered = kodeQ.trim()
    ? allSales.filter((s) =>
        s.kode_transaksi.toLowerCase().includes(kodeQ.trim().toLowerCase())
      )
    : allSales;

  function handleBrowse() {
    listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function resetForm() {
    setSelected(null);
    setReturnItems([]);
    setAlasan("");
    setCatatan("");
    setKodeQ("");
  }

  function selectSale(s) {
    setSelected(s);
    setReturnItems(
      s.items.map((it) => ({
        ...it,
        return_qty: 0,
        checked: false,
        // available_qty dari backend sudah memperhitungkan retur sebelumnya
        max_qty: it.available_qty ?? it.qty,
      }))
    );
  }

  function toggleItem(idx) {
    setReturnItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        // Jangan izinkan check jika tidak ada sisa qty
        if (!it.checked && it.max_qty <= 0) return it;
        return { ...it, checked: !it.checked, return_qty: !it.checked ? 1 : 0 };
      })
    );
  }

  function setQty(idx, val) {
    setReturnItems((prev) =>
      prev.map((it, i) =>
        // Boleh diisi melebihi batas → DITOLAK saat confirm & tercatat REJECTED
        // di audit (demonstratif), tidak di-clamp diam-diam di sini.
        i === idx ? { ...it, return_qty: Math.max(0, val) } : it
      )
    );
  }

  const checkedItems = returnItems.filter((it) => it.checked && it.return_qty > 0);

  async function handleSubmit() {
    setConfirm(false);
    setSubmitting(true);
    try {
      const res = await adjustmentsApi.create({
        type: "sales_return",
        reference_sale_id: selected.id,
        alasan,
        catatan: catatan || null,
        items: checkedItems.map((it) => ({
          product_id: it.product_id,
          qty: it.return_qty,
          kondisi: "bagus",
          harga_satuan: it.harga_satuan,
        })),
      });

      qc.invalidateQueries({ queryKey: ["adjustments"] });
      qc.invalidateQueries({ queryKey: ["notif-pending-approval"] });

      if (res.data?.status === "pending") {
        toast.info("Retur dibuat — menunggu persetujuan admin");
        setOverrideData({ adjustmentId: res.data.id, kode: res.data.kode_adjustment });
        setPinUsername("");
        setPinPassword("");
        setPinError("");
      } else {
        toast.success(res.message || "Retur pelanggan berhasil.");
        resetForm();
      }
    } catch (err) {
      toast.error(err.message || "Gagal menyimpan retur");
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePinApprove() {
    if (!pinUsername.trim() || !pinPassword.trim()) {
      setPinError("Username dan password admin wajib diisi");
      return;
    }
    setPinSubmitting(true);
    setPinError("");
    try {
      const res = await adjustmentsApi.approvePin(overrideData.adjustmentId, {
        username: pinUsername.trim(),
        password: pinPassword,
      });
      toast.success(res.message || "Retur disetujui!");
      setOverrideData(null);
      resetForm();
      qc.invalidateQueries({ queryKey: ["adjustments"] });
      qc.invalidateQueries({ queryKey: ["notif-pending-approval"] });
    } catch (err) {
      setPinError(err.message || "Gagal memverifikasi");
    } finally {
      setPinSubmitting(false);
    }
  }

  return {
    user,
    kodeQ, setKodeQ,
    loading, filtered, listRef, handleBrowse,
    selected, setSelected, selectSale, resetForm,
    returnItems, toggleItem, setQty,
    alasan, setAlasan, catatan, setCatatan,
    confirm, setConfirm, submitting,
    checkedItems, handleSubmit,
    // override
    overrideData, setOverrideData,
    pinUsername, setPinUsername,
    pinPassword, setPinPassword,
    pinSubmitting, pinError, handlePinApprove,
  };
}
