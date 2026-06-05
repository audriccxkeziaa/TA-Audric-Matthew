"use client";
// features/master-barang/hooks/useMasterBarang.js
// Logika & state halaman Master Barang: pencarian (debounce 300ms), filter
// merk, filter kondisi stok, filter status, paging, scan barcode, kontrol modal.

import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { productsApi } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

function normKode(k) {
  return (k || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

export function useMasterBarang() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [merkFilter, setMerkFilter] = useState("");
  const [stockFilter, setStockFilter] = useState(""); // "" | "out" | "low" | "normal"
  const [statusFilter, setStatusFilter] = useState("aktif"); // "aktif" | "nonaktif"
  const [page, setPage] = useState(1);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showView, setShowView] = useState(false);
  const [viewProduct, setViewProduct] = useState(null);

  const barcodeRef = useRef(null);
  const [barcodeInput, setBarcodeInput] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setQ(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  function handleBarcodeSearch(e) {
    e.preventDefault();
    const code = barcodeInput.trim();
    if (!code) return;
    const norm = normKode(code);
    setSearchInput(norm);
    setQ(norm);
    setPage(1);
    setBarcodeInput("");
  }

  function resetSearch() {
    setSearchInput("");
    setQ("");
    setPage(1);
  }

  function openEdit(product) {
    setEditing(product);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
  }

  function openView(product) {
    setViewProduct(product);
    setShowView(true);
  }

  function closeView() {
    setShowView(false);
    setViewProduct(null);
  }

  const merksQ = useQuery({
    queryKey: ["product-merks"],
    queryFn: productsApi.merks,
    staleTime: 60_000,
  });
  const merkList = merksQ.data?.data || [];

  const { data, isLoading } = useQuery({
    queryKey: ["products", q, merkFilter, stockFilter, statusFilter, page],
    queryFn: () =>
      productsApi.list({
        q,
        status: statusFilter || "aktif",
        stock: stockFilter || undefined,
        merk: merkFilter || undefined,
        limit: 20,
        page,
      }),
  });

  const totalPages = data?.total_pages || 1;

  // Prefetch halaman berikutnya → tombol "Next" terasa instan (datanya sudah
  // tersimpan). Bersama placeholderData:keepPreviousData (default global), data
  // lama tetap tampil saat berpindah halaman sehingga tidak ada kedipan "memuat".
  useEffect(() => {
    if (page < totalPages) {
      const next = page + 1;
      queryClient.prefetchQuery({
        queryKey: ["products", q, merkFilter, stockFilter, statusFilter, next],
        queryFn: () =>
          productsApi.list({
            q,
            status: statusFilter || "aktif",
            stock: stockFilter || undefined,
            merk: merkFilter || undefined,
            limit: 20,
            page: next,
          }),
      });
    }
  }, [page, totalPages, q, merkFilter, stockFilter, statusFilter, queryClient]);

  return {
    isAdmin,
    // pencarian & filter
    searchInput,
    setSearchInput,
    merkFilter,
    setMerkFilter,
    stockFilter,
    setStockFilter,
    statusFilter,
    setStatusFilter,
    merkList,
    barcodeInput,
    setBarcodeInput,
    barcodeRef,
    handleBarcodeSearch,
    resetSearch,
    // paging
    page,
    setPage,
    totalPages,
    total: data?.total || 0,
    // data
    products: data?.data || [],
    isLoading,
    // modal form (edit)
    showForm,
    editing,
    openEdit,
    closeForm,
    // modal view (read-only)
    showView,
    viewProduct,
    openView,
    closeView,
  };
}
