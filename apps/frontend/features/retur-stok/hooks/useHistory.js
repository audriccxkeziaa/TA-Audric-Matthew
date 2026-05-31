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

  async function deleteEntry(id, kode) {
    if (!window.confirm(`Hapus riwayat "${kode}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    try {
      await adjustmentsApi.remove(id);
      setData((prev) => prev.filter((r) => r.id !== id));
      toast.success("Riwayat berhasil dihapus");
    } catch {
      toast.error("Gagal menghapus riwayat");
    }
  }

  return {
    data, loading, loaded, load,
    filterType, setFilterType,
    detail, setDetail, detailLoading, openDetail,
    page, setPage, totalPages, pagedData,
    deleteEntry,
  };
}
