"use client";
// features/retur-stok/hooks/usePendingApproval.js — daftar retur pending (admin),
// approve / reject, dan detail. Polling realtime via refetchInterval.

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adjustmentsApi } from "@/lib/api";
import { useToast } from "@/hooks/useToast";

export function usePendingApproval() {
  const toast = useToast();
  const qc = useQueryClient();

  const { data: listData, isLoading } = useQuery({
    queryKey: ["adjustments-pending"],
    queryFn: () => adjustmentsApi.list({ status: "pending", limit: 50 }),
    refetchInterval: 5000,
    staleTime: 2000,
  });
  const pendingItems = listData?.data || [];

  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [rejectId, setRejectId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [processing, setProcessing] = useState(null);

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

  async function handleApprove(id) {
    setProcessing(id);
    try {
      await adjustmentsApi.approve(id);
      toast.success("Retur pelanggan berhasil disetujui");
      qc.invalidateQueries({ queryKey: ["adjustments-pending"] });
      qc.invalidateQueries({ queryKey: ["adjustments"] });
      qc.invalidateQueries({ queryKey: ["notif-pending-approval"] });
      if (detail?.id === id) setDetail(null);
    } catch (err) {
      toast.error(err.message || "Gagal menyetujui");
    } finally {
      setProcessing(null);
    }
  }

  async function handleReject() {
    if (!rejectId) return;
    setProcessing(rejectId);
    try {
      await adjustmentsApi.reject(rejectId, rejectReason);
      toast.success("Retur pelanggan ditolak");
      qc.invalidateQueries({ queryKey: ["adjustments-pending"] });
      qc.invalidateQueries({ queryKey: ["adjustments"] });
      qc.invalidateQueries({ queryKey: ["notif-pending-approval"] });
      setRejectId(null);
      setRejectReason("");
      if (detail?.id === rejectId) setDetail(null);
    } catch (err) {
      toast.error(err.message || "Gagal menolak");
    } finally {
      setProcessing(null);
    }
  }

  return {
    isLoading, pendingItems,
    detail, setDetail, detailLoading, openDetail,
    rejectId, setRejectId, rejectReason, setRejectReason,
    processing, handleApprove, handleReject,
  };
}
