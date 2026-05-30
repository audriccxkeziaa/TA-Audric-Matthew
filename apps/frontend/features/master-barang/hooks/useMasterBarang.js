"use client";
// features/master-barang/hooks/useMasterBarang.js
// Logika & state halaman Master Barang: pencarian (debounce 300ms), filter
// merk, paging, scan barcode, serta kontrol modal form. Data di-fetch via
// React Query memakai service layer lib/api.js. Tidak ada logika bisnis baru —
// semuanya dipindahkan apa adanya dari page.jsx.

import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { productsApi } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

// Normalisasi kode barang: buang non-alfanumerik, uppercase.
function normKode(k) {
  return (k || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

export function useMasterBarang() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [merkFilter, setMerkFilter] = useState("");
  const [page, setPage] = useState(1);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showView, setShowView] = useState(false);
  const [viewProduct, setViewProduct] = useState(null);

  const barcodeRef = useRef(null);
  const [barcodeInput, setBarcodeInput] = useState("");

  // Debounce: hanya kirim query ke backend 300ms setelah user berhenti mengetik
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
    setQ(norm); // langsung set tanpa debounce untuk barcode
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
    queryKey: ["products", q, merkFilter, page],
    queryFn: () =>
      productsApi.list({
        q,
        status: "aktif",
        merk: merkFilter || undefined,
        limit: 20,
        page,
      }),
  });

  return {
    isAdmin,
    // pencarian & filter
    searchInput,
    setSearchInput,
    merkFilter,
    setMerkFilter,
    merkList,
    barcodeInput,
    setBarcodeInput,
    barcodeRef,
    handleBarcodeSearch,
    resetSearch,
    // paging
    page,
    setPage,
    totalPages: data?.total_pages || 1,
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
