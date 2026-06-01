"use client";
// features/retur-stok/hooks/useHistory.js — riwayat retur & penyesuaian dengan
// filter tipe, lazy-load saat pertama dibuka, paging client-side, dan detail.

import { useState, useCallback } from "react";
import { adjustmentsApi } from "@/lib/api";
import { useToast } from "@/hooks/useToast";
import { useQueryClient } from "@tanstack/react-query";

export const HISTORY_PAGE_SIZE = 5;

export function useHistory() {
  const toast = useToast();
  const qc = useQueryClient();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [filterType, setFilterType] = useState("");
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [processing, setProcessing] = useState(null);

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

  async function voidEntry(id) {
    if (!window.confirm("Batalkan retur ini? Stok akan dikembalikan ke posisi semula sebelum retur.")) return;
    setProcessing(id);
    try {
      await adjustmentsApi.void(id);
      toast.success("Retur berhasil dibatalkan — stok sudah dikembalikan");
      qc.invalidateQueries({ queryKey: ["adjustments"] });
      await load(filterType);
    } catch (err) {
      toast.error(err.message || "Gagal membatalkan retur");
    } finally {
      setProcessing(null);
    }
  }

  async function approveEntry(id) {
    if (!window.confirm("Setujui retur ini? Stok akan diproses sesuai dokumen retur.")) return;
    setProcessing(id);
    try {
      await adjustmentsApi.approve(id);
      toast.success("Retur berhasil disetujui");
      qc.invalidateQueries({ queryKey: ["adjustments-pending"] });
      qc.invalidateQueries({ queryKey: ["notif-pending-approval"] });
      await load(filterType);
    } catch (err) {
      toast.error(err.message || "Gagal menyetujui retur");
    } finally {
      setProcessing(null);
    }
  }

  async function cancelEntry(id) {
    if (!window.confirm("Batalkan retur ini? Status akan diubah menjadi Ditolak.")) return;
    setProcessing(id);
    try {
      await adjustmentsApi.reject(id, "Dibatalkan");
      toast.success("Retur berhasil dibatalkan");
      qc.invalidateQueries({ queryKey: ["adjustments-pending"] });
      qc.invalidateQueries({ queryKey: ["notif-pending-approval"] });
      await load(filterType);
    } catch (err) {
      toast.error(err.message || "Gagal membatalkan retur");
    } finally {
      setProcessing(null);
    }
  }

  return {
    data, loading, loaded, load,
    filterType, setFilterType,
    detail, setDetail, detailLoading, openDetail,
    page, setPage, totalPages, pagedData,
    processing, voidEntry, approveEntry, cancelEntry,
  };
}
