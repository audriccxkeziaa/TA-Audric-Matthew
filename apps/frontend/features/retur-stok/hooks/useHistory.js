"use client";
// features/retur-stok/hooks/useHistory.js — riwayat retur & penyesuaian dengan
// filter tipe, lazy-load saat pertama dibuka, paging client-side, dan detail.

import { useState, useCallback } from "react";
import { adjustmentsApi } from "@/lib/api";
import { useToast } from "@/hooks/useToast";

export const HISTORY_PAGE_SIZE = 5;

export function useHistory() {
  const toast = useToast();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [filterType, setFilterType] = useState("");
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [page, setPage] = useState(1);

  const load = useCallback(
    async (type) => {
      setLoading(true);
      setPage(1);
      try {
        const res = await adjustmentsApi.list({ type: type || undefined, limit: 200 });
        setData(res.data || []);
      } catch {
        toast.error("Gagal memuat riwayat");
      } finally {
        setLoading(false);
        setLoaded(true);
      }
    },
    [toast]
  );

  const totalPages = Math.max(1, Math.ceil(data.length / HISTORY_PAGE_SIZE));
  const pagedData = data.slice((page - 1) * HISTORY_PAGE_SIZE, page * HISTORY_PAGE_SIZE);

  async function openDetail(id) {
    setDetailLoading(true);
    try {
      const res = await adjustmentsApi.get(id);
      setDetail(res.data);
    } catch {
      toast.error("Gagal memuat detail");
    } finally {
      setDetailLoading(false);
    }
  }

  // Batalkan retur yang sudah terlanjur diproses (void): stok & refund dibalik,
  // status jadi "dibatalkan", tetap tampil di riwayat + tercatat audit trail.
  const [confirmCancel, setConfirmCancel] = useState(null); // row yang akan dibatalkan
  const [canceling, setCanceling] = useState(false);

  async function doCancel() {
    if (!confirmCancel) return;
    setCanceling(true);
    try {
      await adjustmentsApi.void(confirmCancel.id);
      toast.success("Retur berhasil dibatalkan");
      setConfirmCancel(null);
      await load(filterType);
    } catch (e) {
      toast.error(e?.message || "Gagal membatalkan retur");
    } finally {
      setCanceling(false);
    }
  }

  return {
    data, loading, loaded, load,
    filterType, setFilterType,
    detail, setDetail, detailLoading, openDetail,
    page, setPage, totalPages, pagedData,
    confirmCancel, setConfirmCancel, canceling, doCancel,
  };
}
