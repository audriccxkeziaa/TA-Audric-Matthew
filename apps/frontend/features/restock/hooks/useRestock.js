"use client";
// features/restock/hooks/useRestock.js — rekomendasi restock (R5):
// query list + summary, filter kondisi, paging client-side, kontrol modal detail.

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { restockApi } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

export const PAGE_SIZE = 20;

export function useRestock() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [page, setPage] = useState(1);
  const [detailItem, setDetailItem] = useState(null);
  const [stockFilter, setStockFilter] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["restock"],
    queryFn: restockApi.list,
    staleTime: 30_000,
  });
  const allItems = data?.data || [];
  const summary = data?.summary || { total: 0, habis: 0, kritis: 0, menipis: 0 };

  const items = useMemo(() => {
    if (stockFilter === "all") return allItems;
    return allItems.filter((it) => it.tingkat_urgensi === stockFilter);
  }, [allItems, stockFilter]);

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const paginatedItems = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return {
    isAdmin,
    isLoading,
    summary,
    items,
    paginatedItems,
    page,
    setPage,
    totalPages,
    pageSize: PAGE_SIZE,
    stockFilter,
    setStockFilter,
    detailItem,
    setDetailItem,
  };
}
