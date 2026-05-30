"use client";
// features/retur-stok/hooks/usePenyesuaianStok.js — penyesuaian stok (admin).
// Mendukung dua arah: "kurang" (penyusutan/koreksi minus) dan "tambah" (koreksi plus).

import { useState } from "react";
import { adjustmentsApi } from "@/lib/api";
import { useToast } from "@/hooks/useToast";

export function usePenyesuaianStok() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [alasan, setAlasan] = useState("");
  const [catatan, setCatatan] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function addProduct(product) {
    if (items.some((it) => it.product_id === product.id)) {
      toast.info("Barang sudah ada di daftar");
      return;
    }
    setItems((prev) => [
      ...prev,
      {
        product_id: product.id,
        kode_barang: product.kode_barang,
        nama_barang: product.nama_barang,
        merk: product.merk,
        stok: product.stok,
        harga_beli: Number(product.harga_beli),
        qty: 1,
        arah: "kurang",
      },
    ]);
  }

  function removeItem(idx) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function setQty(idx, val) {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const clipped = it.arah === "kurang" ? Math.min(val, it.stok) : val;
        return { ...it, qty: Math.max(1, clipped) };
      })
    );
  }

  function setArah(idx, arah) {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        // bila switch ke kurang dan qty melebihi stok, sesuaikan
        const qty = arah === "kurang" ? Math.min(it.qty, it.stok) : it.qty;
        return { ...it, arah, qty };
      })
    );
  }

  async function handleSubmit() {
    setConfirm(false);
    setSubmitting(true);
    try {
      const res = await adjustmentsApi.create({
        type: "stock_adjustment",
        alasan,
        catatan: catatan || null,
        items: items.map((it) => ({
          product_id: it.product_id,
          qty: it.qty,
          harga_satuan: it.harga_beli,
          arah: it.arah,
        })),
      });
      toast.success(res.message || "Penyesuaian stok berhasil.");
      setItems([]);
      setAlasan("");
      setCatatan("");
    } catch (err) {
      toast.error(err.message || "Gagal menyimpan penyesuaian.");
    } finally {
      setSubmitting(false);
    }
  }

  const totalKurang = items
    .filter((it) => it.arah === "kurang")
    .reduce((s, it) => s + it.qty, 0);
  const totalTambah = items
    .filter((it) => it.arah === "tambah")
    .reduce((s, it) => s + it.qty, 0);

  return {
    items, addProduct, removeItem, setQty, setArah,
    alasan, setAlasan, catatan, setCatatan,
    pickerOpen, setPickerOpen,
    confirm, setConfirm, submitting,
    totalKurang, totalTambah,
    handleSubmit,
  };
}
