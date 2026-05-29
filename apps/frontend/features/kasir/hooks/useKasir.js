"use client";
// features/kasir/hooks/useKasir.js — seluruh logika POS:
//   - state keranjang + operasi (tambah, qty, diskon, hapus, kosongkan)
//   - total/subtotal/diskon/qty (useMemo) & deteksi over-stock
//   - submit barcode/kode (exact → parsial → multi-match)
//   - shortcut F1/F2/F12/Esc
//   - mutation transaksi (R1 ditangani backend)
// Logika dipindahkan apa adanya dari page.jsx.

import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { productsApi, salesApi } from "@/lib/api";
import { useToast } from "@/hooks/useToast";
import { useDebounce } from "@/hooks/useDebounce";

export function useKasir() {
  const toast = useToast();
  const barcodeRef = useRef(null);
  const searchRef = useRef(null);
  const lastQtyRef = useRef(1);
  const tunaiRef = useRef(0);

  // ----- State -----
  const [barcode, setBarcode] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 300);
  const [cart, setCart] = useState([]); // [{id, kode_barang, nama_barang, harga_jual, stok, qty}]
  const [bayarOpen, setBayarOpen] = useState(false);
  const [receipt, setReceipt] = useState(null);

  // ----- Pencarian produk untuk panel cari -----
  const { data: searchRes, isFetching: searchFetching } = useQuery({
    queryKey: ["pos-products", debouncedQ],
    queryFn: () =>
      productsApi.list({ q: debouncedQ, status: "aktif", limit: 30 }),
    enabled: searchOpen,
  });
  const results = searchRes?.data || [];

  // ----- Total (dengan diskon per item) -----
  const subtotal = useMemo(
    () => cart.reduce((s, x) => s + x.harga_jual * x.qty, 0),
    [cart]
  );
  const totalDiskon = useMemo(
    () =>
      cart.reduce(
        (s, x) => s + x.harga_jual * x.qty * ((x.diskon_persen || 0) / 100),
        0
      ),
    [cart]
  );
  const total = subtotal - totalDiskon;
  const totalQty = useMemo(() => cart.reduce((s, x) => s + x.qty, 0), [cart]);
  const overStock = cart.filter((x) => x.qty > x.stok);

  function lineSubtotal(x) {
    return x.harga_jual * x.qty * (1 - (x.diskon_persen || 0) / 100);
  }

  // ----- Operasi keranjang -----
  function addToCart(p, qty = 1) {
    if (!p) return;
    setCart((c) => {
      const idx = c.findIndex((x) => x.id === p.id);
      if (idx >= 0) {
        const next = [...c];
        next[idx] = {
          ...next[idx],
          qty: next[idx].qty + qty,
          stok: Number(p.stok), // update stok from fresh data
        };
        return next;
      }
      return [
        ...c,
        {
          id: p.id,
          kode_barang: p.kode_barang,
          nama_barang: p.nama_barang,
          merk: p.merk,
          harga_beli: Number(p.harga_beli) || 0,
          harga_jual: Number(p.harga_jual),
          stok: Number(p.stok),
          qty,
          diskon_persen: 0,
        },
      ];
    });
    toast.success(`+ ${qty} × ${p.nama_barang}`);
  }
  function setQty(id, qty) {
    setCart((c) =>
      c.map((x) => (x.id === id ? { ...x, qty: Math.max(1, qty) } : x))
    );
  }
  function setDiskon(id, persen) {
    const v = Math.max(0, Math.min(100, Number(persen) || 0));
    setCart((c) => c.map((x) => (x.id === id ? { ...x, diskon_persen: v } : x)));
  }
  function removeItem(id) {
    setCart((c) => c.filter((x) => x.id !== id));
  }
  function clearCart() {
    setCart([]);
    setBarcode("");
    setQ("");
    barcodeRef.current?.focus();
  }

  function toggleSearch() {
    setSearchOpen((v) => !v);
    setTimeout(() => searchRef.current?.focus(), 50);
  }

  // ----- Submit barcode/kode -----
  async function handleBarcodeSubmit(e) {
    e?.preventDefault();
    const code = barcode.trim();
    if (!code) return;
    try {
      // Cari by kode (backend ILIKE — kita filter exact match di FE)
      const res = await productsApi.list({ q: code, status: "aktif", limit: 5 });
      const items = res?.data || [];
      const norm = (k) => (k || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
      const exact = items.find((p) => norm(p.kode_barang) === norm(code));

      if (exact) {
        if (Number(exact.stok) <= 0) {
          toast.error(`${exact.nama_barang} stok habis`);
        } else {
          addToCart(exact, lastQtyRef.current);
        }
        setBarcode("");
        barcodeRef.current?.focus();
        return;
      }

      if (items.length === 1) {
        // Hanya 1 hasil parsial → langsung tambah
        const p = items[0];
        if (Number(p.stok) <= 0) {
          toast.error(`${p.nama_barang} stok habis`);
        } else {
          addToCart(p, lastQtyRef.current);
        }
        setBarcode("");
        barcodeRef.current?.focus();
        return;
      }

      if (items.length > 1) {
        // Multiple match → buka pencarian
        toast.error(`${items.length} barang cocok dengan "${code}" — pilih dari pencarian`);
        setSearchOpen(true);
        setQ(code);
        searchRef.current?.focus();
        return;
      }

      toast.error(`Kode "${code}" tidak ditemukan`);
    } catch (err) {
      toast.error(err.message || "Gagal mencari barang");
    }
  }

  // ----- Shortcut F-keys -----
  useEffect(() => {
    function onKey(e) {
      // Hanya bertindak kalau tidak sedang di textarea
      if (e.key === "F1") {
        e.preventDefault();
        barcodeRef.current?.focus();
        barcodeRef.current?.select();
      } else if (e.key === "F2") {
        e.preventDefault();
        setSearchOpen((v) => !v);
        setTimeout(() => searchRef.current?.focus(), 50);
      } else if (e.key === "F12") {
        e.preventDefault();
        if (cart.length > 0 && overStock.length === 0) {
          setBayarOpen(true);
        }
      } else if (e.key === "Escape") {
        if (bayarOpen) setBayarOpen(false);
        else if (searchOpen) setSearchOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cart.length, overStock.length, bayarOpen, searchOpen]);

  // ----- Proses transaksi -----
  const sale = useMutation({
    mutationFn: () =>
      salesApi.create({
        items: cart.map((x) => ({
          product_id: x.id,
          qty: x.qty,
          harga_satuan: x.harga_jual,
          diskon_persen: x.diskon_persen || 0,
        })),
      }),
    onSuccess: (res) => {
      setReceipt({ ...res.data, tunai: tunaiRef.current });
      clearCart();
      setBayarOpen(false);
      toast.success("Transaksi berhasil disimpan.");
    },
    onError: (e) => {
      if (e.rule === "R1") {
        toast.error("Transaksi ditolak (R1): " + e.message);
      } else {
        toast.error(e.message || "Transaksi gagal");
      }
    },
  });

  function confirmBayar(uangTunai) {
    tunaiRef.current = uangTunai;
    sale.mutate();
  }

  return {
    // refs
    barcodeRef,
    searchRef,
    lastQtyRef,
    // barcode + search
    barcode,
    setBarcode,
    searchOpen,
    setSearchOpen,
    toggleSearch,
    q,
    setQ,
    results,
    searchFetching,
    handleBarcodeSubmit,
    // cart
    cart,
    addToCart,
    setQty,
    setDiskon,
    removeItem,
    clearCart,
    lineSubtotal,
    // totals
    subtotal,
    totalDiskon,
    total,
    totalQty,
    overStock,
    // checkout
    bayarOpen,
    setBayarOpen,
    confirmBayar,
    saleProcessing: sale.isPending,
    // receipt
    receipt,
    setReceipt,
  };
}
