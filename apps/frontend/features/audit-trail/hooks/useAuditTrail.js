"use client";
// features/audit-trail/hooks/useAuditTrail.js — filter, paging, kontrol modal,
// query users + audit logs, dan export CSV. Catatan: queryKey ["audit", query]
// dipertahankan apa adanya (bukan ["audit-logs"]).

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { auditApi, usersApi } from "@/lib/api";
import { downloadFile } from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { isoDate } from "@/lib/format";

const PAGE_SIZE = 20;

export function useAuditTrail() {
  const { user } = useAuth();
  const toast = useToast();

  const [filters, setFilters] = useState({
    from: "",
    to: "",
    user_id: "",
    product_id: "",
    rule: "",
    action: "",
    source_type: "",
  });
  const [productLabel, setProductLabel] = useState("");
  const [page, setPage] = useState(1);
  const [openPicker, setOpenPicker] = useState(false);
  const [detailRow, setDetailRow] = useState(null);

  const usersQ = useQuery({ queryKey: ["users"], queryFn: usersApi.list });
  const users = usersQ.data?.data || [];

  const query = { ...filters, page, page_size: PAGE_SIZE };
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["audit", query],
    queryFn: () => auditApi.list(query),
  });

  function setFilter(field, value) {
    setFilters((f) => ({ ...f, [field]: value }));
    setPage(1);
  }

  async function exportCsv() {
    try {
      await downloadFile("/audit-logs", {
        query: { ...filters, format: "csv" },
        filename: `audit-trail_${isoDate()}.csv`,
      });
      toast.success("CSV diunduh");
    } catch (e) {
      toast.error(e.message || "Gagal mengunduh CSV");
    }
  }

  return {
    user,
    users,
    filters,
    setFilter,
    productLabel,
    setProductLabel,
    page,
    setPage,
    pageSize: PAGE_SIZE,
    openPicker,
    setOpenPicker,
    detailRow,
    setDetailRow,
    rows: data?.rows || [],
    totalPages: data?.total_pages || 1,
    total: data?.total || 0,
    isLoading,
    isFetching,
    exportCsv,
  };
}
