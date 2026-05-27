"use client";
// =================================================================
// /kasir — Point of Sale (gaya BEEPOS, terinspirasi POS klasik)
// =================================================================
// Fitur:
//   - Input barcode / kode produk (F1, auto-fokus). Enter → tambah ke
//     keranjang. Cocok untuk USB barcode scanner (emulate keyboard +
//     Enter).
//   - Pencarian by nama / kode (collapsible) sebagai fallback bila
//     kode tidak terbaca.
//   - Tabel keranjang dengan: No, Kode, Nama, Qty (editable), Harga,
//     Subtotal, Hapus.
//   - Footer: Total Produk, Total Qty, SUBTOTAL, TOTAL besar.
//   - F12 → modal BAYAR: input uang diterima, kembalian dihitung
//     otomatis, tombol "Selesai" menjalankan transaksi.
//   - F-key shortcuts: F1 fokus input, F2 toggle pencarian, F12 bayar.
//   - Aturan R1 (Pencegahan Stok Negatif) di backend; bila qty > stok
//     transaksi DITOLAK utuh.
// =================================================================

import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { productsApi, salesApi } from "@/lib/api";
import { useToast } from "@/hooks/useToast";
import { useDebounce } from "@/hooks/useDebounce";
import { rupiah, angka } from "@/lib/format";
import { printReceipt } from "@/lib/receipt";
import {
  PageShell,
  PageHeader,
  Card,
  Button,
  Badge,
  Modal,
  Spinner,
  EmptyState,
} from "@/components/ui";

export default function KasirPage() {
  const toast = useToast();
  const barcodeRef = useRef(null);
  const searchRef = useRef(null);
  const lastQtyRef = useRef(1);

  // ----- State -----
  const [barcode, setBarcode] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 300);
  const [cart, setCart] = useState([]); // [{id, kode_barang, nama_barang, harga_jual, stok, qty}]
  const [bayarOpen, setBayarOpen] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const tunaiRef = useRef(0);

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
  const totalQty = useMemo(
    () => cart.reduce((s, x) => s + x.qty, 0),
    [cart]
  );
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
      const exact = items.find(
        (p) => norm(p.kode_barang) === norm(code)
      );

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
      toast.success("Transaksi berhasil disimpan");
    },
    onError: (e) => {
      if (e.rule === "R1") {
        toast.error("Transaksi ditolak (R1): " + e.message);
      } else {
        toast.error(e.message || "Transaksi gagal");
      }
    },
  });

  return (
    <PageShell>
      <PageHeader
        title="Kasir — Transaksi Penjualan"
        description="Scan barcode / ketik kode produk lalu Enter."
      />

      {/* Barcode/Kode input — primary entry */}
      <Card className="shrink-0 border-2 border-brand-500 p-3">
        <form onSubmit={handleBarcodeSubmit} className="flex flex-wrap gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-lg bg-slate-50 px-3">
            <svg
              className="h-5 w-5 shrink-0 text-slate-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M3 5v14M7 5v14M11 5v14M15 5v14M19 5v14" />
            </svg>
            <input
              ref={barcodeRef}
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="Scan barcode atau ketik kode produk lalu Enter… (F1)"
              autoFocus
              className="flex-1 bg-transparent py-2.5 text-base font-mono outline-none placeholder:text-slate-400"
            />
            <kbd className="hidden rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 sm:inline">
              F1
            </kbd>
          </div>
          <Button type="submit" size="lg">
            Add
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={() => {
              setSearchOpen((v) => !v);
              setTimeout(() => searchRef.current?.focus(), 50);
            }}
          >
            <span className="hidden sm:inline">Browse (F2)</span>
            <span className="sm:hidden">Browse</span>
          </Button>
        </form>
      </Card>

      {/* Panel pencarian collapsible (F2) */}
      {searchOpen && (
        <Card className="mt-2 shrink-0 p-3">
          <div className="flex items-center gap-2">
            <input
              ref={searchRef}
              placeholder="Cari nama atau kode barang…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button
              onClick={() => setSearchOpen(false)}
              className="text-xs text-slate-500 hover:underline"
            >
              Tutup
            </button>
          </div>
          <div className="mt-2 max-h-48 space-y-1 overflow-y-auto thin-scroll">
            {searchFetching && (
              <div className="py-3">
                <Spinner label="Mencari…" />
              </div>
            )}
            {!searchFetching && results.length === 0 && q && (
              <p className="py-2 text-center text-xs text-slate-400">
                Tidak ada hasil
              </p>
            )}
            {!searchFetching &&
              results.map((p) => {
                const habis = Number(p.stok) === 0;
                return (
                  <button
                    key={p.id}
                    disabled={habis}
                    onClick={() => {
                      addToCart(p, 1);
                      setQ("");
                      barcodeRef.current?.focus();
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-left transition hover:border-brand-400 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {p.nama_barang}
                      </p>
                      <p className="text-xs text-slate-400">
                        {p.kode_barang} · {p.merk || "-"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{rupiah(p.harga_jual)}</p>
                      <p className="text-[11px] text-slate-400">Beli: {rupiah(p.harga_beli)}</p>
                      <p className="text-xs">
                        {habis ? (
                          <Badge tone="red">Habis</Badge>
                        ) : (
                          <span className="text-slate-400">
                            Stok {angka(p.stok)}
                          </span>
                        )}
                      </p>
                    </div>
                  </button>
                );
              })}
          </div>
        </Card>
      )}

      {/* Tabel keranjang */}
      <Card className="mt-3 flex flex-col p-0 md:min-h-0 md:flex-1">
        <div className="overflow-auto thin-scroll md:min-h-0 md:flex-1">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="sticky top-0 bg-slate-100 text-left text-xs uppercase text-slate-600">
              <tr>
                <th className="px-3 py-2.5 text-center">No</th>
                <th className="px-3 py-2.5">Kode Barang</th>
                <th className="px-3 py-2.5">Nama Barang</th>
                <th className="px-3 py-2.5 text-center">Qty</th>
                <th className="px-3 py-2.5 text-right">Harga Beli</th>
                <th className="px-3 py-2.5 text-right">Harga Jual</th>
                <th className="px-3 py-2.5 text-center">Disc %</th>
                <th className="px-3 py-2.5 text-right">Subtotal</th>
                <th className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cart.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <EmptyState
                      title="Keranjang kosong"
                      description="Scan barcode atau ketik kode di atas, atau tekan F2 untuk mencari."
                    />
                  </td>
                </tr>
              ) : (
                cart.map((x, i) => {
                  const over = x.qty > x.stok;
                  return (
                    <tr
                      key={x.id}
                      className={over ? "bg-red-50" : "hover:bg-slate-50"}
                    >
                      <td className="px-3 py-2.5 text-center text-slate-400">
                        {i + 1}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs">
                        {x.kode_barang}
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-slate-800">
                          {x.nama_barang}
                        </p>
                        {over && (
                          <p className="text-xs text-red-600">
                            Qty melebihi stok ({angka(x.stok)}) — akan ditolak R1
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setQty(x.id, x.qty - 1)}
                            className="h-7 w-7 rounded bg-slate-200 font-bold text-slate-700 hover:bg-slate-300"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={x.qty}
                            onChange={(e) => {
                              const n = parseInt(e.target.value, 10) || 1;
                              setQty(x.id, n);
                              lastQtyRef.current = n;
                            }}
                            className="h-7 w-14 rounded border border-slate-300 text-center text-sm"
                          />
                          <button
                            onClick={() => setQty(x.id, x.qty + 1)}
                            className="h-7 w-7 rounded bg-slate-200 font-bold text-slate-700 hover:bg-slate-300"
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right text-slate-500">
                        {rupiah(x.harga_beli)}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {rupiah(x.harga_jual)}
                      </td>
                      <td className="px-3 py-2.5">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          value={x.diskon_persen || 0}
                          onChange={(e) => setDiskon(x.id, e.target.value)}
                          onFocus={(e) => e.target.select()}
                          className="h-7 w-16 rounded border border-slate-300 text-center text-sm"
                          title="Diskon (%) — default 0"
                        />
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold">
                        {rupiah(lineSubtotal(x))}
                        {x.diskon_persen > 0 && (
                          <p className="text-[10px] font-normal text-slate-400 line-through">
                            {rupiah(x.harga_jual * x.qty)}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          onClick={() => removeItem(x.id)}
                          className="text-xs text-red-500 hover:underline"
                          title="Hapus"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer total — selalu terlihat */}
        <div className="shrink-0 border-t-2 border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
              <span>
                Total Produk:{" "}
                <b className="text-slate-900">{angka(cart.length)}</b>
              </span>
              <span>
                Total Qty:{" "}
                <b className="text-slate-900">{angka(totalQty)}</b>
              </span>
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-xs text-red-600 hover:underline"
                >
                  Kosongkan keranjang
                </button>
              )}
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                {totalDiskon > 0 && (
                  <>
                    <p className="text-xs text-slate-500">
                      Subtotal:{" "}
                      <span className="line-through">{rupiah(subtotal)}</span>
                    </p>
                    <p className="text-xs font-medium text-emerald-600">
                      Diskon: − {rupiah(totalDiskon)}
                    </p>
                  </>
                )}
                <p className="text-xs text-slate-500">TOTAL</p>
                <p className="text-xl font-extrabold text-slate-900 sm:text-3xl">
                  {rupiah(total)}
                </p>
              </div>
              <Button
                size="lg"
                disabled={
                  cart.length === 0 || overStock.length > 0 || sale.isPending
                }
                onClick={() => setBayarOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                💰 CHECKOUT (F12)
              </Button>
            </div>
          </div>
          {overStock.length > 0 && (
            <p className="mt-1.5 text-right text-xs text-red-600">
              {overStock.length} barang melebihi stok — perbaiki dulu.
            </p>
          )}
        </div>
      </Card>

      {/* Modal Bayar */}
      <BayarModal
        open={bayarOpen}
        onClose={() => setBayarOpen(false)}
        total={total}
        cart={cart}
        onConfirm={(uangTunai) => { tunaiRef.current = uangTunai; sale.mutate(); }}
        processing={sale.isPending}
      />

      {/* Modal Struk hasil */}
      <Modal
        open={Boolean(receipt)}
        onClose={() => setReceipt(null)}
        title="Transaksi Berhasil"
      >
        {receipt && (
          <div>
            <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              Transaksi <b>{receipt.kode_transaksi}</b> tersimpan. Stok sudah
              diperbarui otomatis.
            </div>
            <table className="mt-3 w-full text-sm">
              <thead className="text-left text-xs uppercase text-slate-400">
                <tr>
                  <th className="py-1">Barang</th>
                  <th className="py-1 text-right">Qty</th>
                  <th className="py-1 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {receipt.items.map((it) => (
                  <tr key={it.id}>
                    <td className="py-1.5">{it.nama_barang}</td>
                    <td className="py-1.5 text-right">{it.qty}</td>
                    <td className="py-1.5 text-right">{rupiah(it.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 font-bold">
              <span>Total</span>
              <span>{rupiah(receipt.total_harga)}</span>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setReceipt(null)}>
                Tutup
              </Button>
              <Button onClick={() => printReceipt(receipt)}>Cetak Struk</Button>
            </div>
          </div>
        )}
      </Modal>
    </PageShell>
  );
}

// =================================================================
// Modal BAYAR — input uang diterima, hitung kembalian otomatis
// =================================================================
function BayarModal({ open, onClose, total, cart, onConfirm, processing }) {
  const [tunai, setTunai] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setTunai("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const n = Number(tunai.replace(/\./g, "")) || 0;
  const kembalian = n - total;
  const cukup = n >= total;

  // Quick cash buttons — denominasi umum
  const quickAmounts = useMemo(() => {
    const base = [
      Math.ceil(total / 1000) * 1000, // pas
      Math.ceil(total / 5000) * 5000,
      Math.ceil(total / 10000) * 10000,
      50000,
      100000,
    ];
    return [...new Set(base)].filter((v) => v >= total).slice(0, 5);
  }, [total]);

  function onKeyDown(e) {
    if (e.key === "Enter" && cukup && !processing) {
      onConfirm(n);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Pembayaran" width="max-w-md">
      <div className="space-y-4">
        <div className="rounded-lg bg-slate-100 p-4 text-center">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Total Belanja
          </p>
          <p className="mt-1 text-3xl font-extrabold text-slate-900">
            {rupiah(total)}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            {cart.length} jenis ·{" "}
            {cart.reduce((s, x) => s + x.qty, 0)} item
          </p>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            Uang Diterima (Tunai)
          </span>
          <div className="flex items-center rounded-lg border border-slate-300 px-3 focus-within:ring-2 focus-within:ring-brand-500">
            <span className="text-slate-400">Rp</span>
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              value={tunai}
              onChange={(e) => {
                const v = e.target.value.replace(/[^\d]/g, "");
                setTunai(v ? Number(v).toLocaleString("id-ID") : "");
              }}
              onKeyDown={onKeyDown}
              placeholder="0"
              className="ml-2 flex-1 bg-transparent py-2.5 text-right text-lg font-semibold outline-none"
            />
          </div>
        </label>

        {/* Quick cash buttons */}
        {quickAmounts.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setTunai(total.toLocaleString("id-ID"))}
              className="rounded-md bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-200"
            >
              UANG PAS
            </button>
            {quickAmounts.map((v) => (
              <button
                key={v}
                onClick={() => setTunai(v.toLocaleString("id-ID"))}
                className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
              >
                {rupiah(v)}
              </button>
            ))}
          </div>
        )}

        {/* Kembalian */}
        <div
          className={`rounded-lg border-2 p-4 text-center transition ${
            cukup
              ? "border-emerald-300 bg-emerald-50"
              : n > 0
                ? "border-red-300 bg-red-50"
                : "border-slate-200 bg-slate-50"
          }`}
        >
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Kembalian
          </p>
          <p
            className={`mt-1 text-3xl font-extrabold ${
              cukup
                ? "text-emerald-700"
                : n > 0
                  ? "text-red-700"
                  : "text-slate-400"
            }`}
          >
            {cukup ? rupiah(kembalian) : n > 0 ? `Kurang ${rupiah(total - n)}` : "—"}
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} disabled={processing}>
            Batal (Esc)
          </Button>
          <Button
            onClick={() => onConfirm(n)}
            disabled={!cukup || processing}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {processing ? "Memproses…" : "Selesai (Enter)"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
