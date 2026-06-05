"use client";
// features/kasir/hooks/useKasir.js — seluruh logika POS:
//   - state keranjang + operasi (tambah, qty, diskon, hapus, kosongkan)
//   - total/subtotal/diskon/qty (useMemo) & deteksi over-stock
//   - submit barcode/kode (exact → parsial → multi-match)
//   - realtime sync harga dan data produk di keranjang (via Supabase subscription)
//   - shortcut F1/F2/F12/Esc
//   - mutation transaksi (R1 ditangani backend)

import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { productsApi, salesApi } from "@/lib/api";
import { useToast } from "@/hooks/useToast";
import { useDebounce } from "@/hooks/useDebounce";
import { supabase } from "@/lib/supabase";

// Keranjang disimpan di sessionStorage: bertahan saat kasir pindah menu &
// refresh halaman, tetapi otomatis hilang ketika tab/website ditutup. Saat
// logout, dibersihkan oleh clearSession() di lib/api-client.js.
const CART_KEY = "pos.kasir_cart";

export function useKasir() {
  const toast = useToast();
  const barcodeRef = useRef(null);
  const searchRef = useRef(null);
  const lastQtyRef = useRef(1);
  const tunaiRef = useRef(0);
  const cartLoadedRef = useRef(false);

  // ----- State -----
  const [barcode, setBarcode] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 300);
  const [cart, setCart] = useState([]); // [{id, kode_barang, nama_barang, harga_jual, stok, qty, status}]
  const [bayarOpen, setBayarOpen] = useState(false);
  const [receipt, setReceipt] = useState(null);

  // ----- Persistensi keranjang (sessionStorage) -----
  // Bertahan saat pindah menu / refresh; hilang otomatis saat tab/website
  // ditutup, atau saat logout (clearSession). Effect SIMPAN sengaja ditaruh
  // SEBELUM effect MUAT agar saat mount tidak menimpa data tersimpan dengan
  // keranjang kosong.
  useEffect(() => {
    if (!cartLoadedRef.current) return;
    try {
      window.sessionStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch {}
  }, [cart]);
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(CART_KEY);
      const saved = raw ? JSON.parse(raw) : null;
      if (Array.isArray(saved) && saved.length) setCart(saved);
    } catch {}
    cartLoadedRef.current = true;
  }, []);

  // ----- Pencarian produk — termasuk nonaktif agar kasir bisa melihatnya -----
  const { data: searchRes, isFetching: searchFetching } = useQuery({
    queryKey: ["pos-products", debouncedQ],
    queryFn: () =>
      productsApi.list({ q: debouncedQ, status: "all", limit: 1000 }),
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
          stok: Number(p.stok),
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
          status: p.status || "aktif",
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

  // ----- Realtime sync: update harga & data produk di keranjang secara langsung -----
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel("kasir-cart-product-sync")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "products" },
        (payload) => {
          const p = payload.new;
          setCart((c) => {
            if (!c.some((x) => x.id === p.id)) return c;
            return c.map((x) =>
              x.id === p.id
                ? {
                    ...x,
                    harga_jual: Number(p.harga_jual),
                    harga_beli: Number(p.harga_beli) || 0,
                    stok: Number(p.stok),
                    nama_barang: p.nama_barang,
                    kode_barang: p.kode_barang,
                    merk: p.merk || x.merk,
                    status: p.status,
                  }
                : x
            );
          });
        }
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  // ----- Submit barcode/kode -----
  async function handleBarcodeSubmit(e) {
    e?.preventDefault();
    const code = barcode.trim();
    if (!code) return;
    try {
      const res = await productsApi.list({ q: code, status: "all", limit: 5 });
      const items = res?.data || [];
      const norm = (k) => (k || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
      const exact = items.find((p) => norm(p.kode_barang) === norm(code));

      if (exact) {
        if (exact.status === "nonaktif") {
          toast.error(`${exact.nama_barang} sudah discontinue — tidak dapat ditambahkan`);
        } else if (Number(exact.stok) <= 0) {
          toast.error(`${exact.nama_barang} stok habis`);
        } else {
          addToCart(exact, lastQtyRef.current);
        }
        setBarcode("");
        barcodeRef.current?.focus();
        return;
      }

      if (items.length === 1) {
        const p = items[0];
        if (p.status === "nonaktif") {
          toast.error(`${p.nama_barang} sudah discontinue — tidak dapat ditambahkan`);
        } else if (Number(p.stok) <= 0) {
          toast.error(`${p.nama_barang} stok habis`);
        } else {
          addToCart(p, lastQtyRef.current);
        }
        setBarcode("");
        barcodeRef.current?.focus();
        return;
      }

      if (items.length > 1) {
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
          diskon_persen: Number(x.diskon_persen) || 0,
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
    barcodeRef,
    searchRef,
    lastQtyRef,
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
    cart,
    addToCart,
    setQty,
    setDiskon,
    removeItem,
    clearCart,
    lineSubtotal,
    subtotal,
    totalDiskon,
    total,
    totalQty,
    overStock,
    bayarOpen,
    setBayarOpen,
    confirmBayar,
    saleProcessing: sale.isPending,
    receipt,
    setReceipt,
  };
}
