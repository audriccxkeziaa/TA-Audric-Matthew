"use client";
// features/master-barang/hooks/useProductForm.js
// State + mutation form tambah/edit barang. Validasi sisi klien & payload
// dipindahkan apa adanya dari komponen ProductForm lama (tidak diubah):
//   - kode & nama wajib
//   - alasan wajib saat admin meng-edit (audit trail)
//   - min_stock hanya dikirim oleh admin (RBAC field-level; backend tolak kasir)

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { productsApi } from "@/lib/api";
import { useToast } from "@/hooks/useToast";

export function useProductForm({ editing, isAdmin, onClose }) {
  const qc = useQueryClient();
  const toast = useToast();
  const isEdit = Boolean(editing);

  const [form, setForm] = useState(() => ({
    kode_barang: editing?.kode_barang || "",
    nama_barang: editing?.nama_barang || "",
    merk: editing?.merk || "",
    harga_beli: editing?.harga_beli ?? "",
    harga_jual: editing?.harga_jual ?? "",
    min_stock: editing?.min_stock ?? 0,
  }));
  const [alasan, setAlasan] = useState("");
  const [err, setErr] = useState("");

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  const mutation = useMutation({
    mutationFn: async () => {
      // Validasi sisi klien sebelum kirim.
      if (!form.kode_barang.trim() || !form.nama_barang.trim()) {
        throw new Error("Kode dan nama barang wajib diisi");
      }
      if (isEdit && isAdmin && !alasan.trim()) {
        throw new Error("Alasan perubahan wajib diisi (untuk audit trail).");
      }
      const body = {
        kode_barang: form.kode_barang.trim(),
        nama_barang: form.nama_barang.trim(),
        merk: form.merk.trim() || null,
        harga_beli: Number(form.harga_beli) || 0,
        harga_jual: Number(form.harga_jual) || 0,
      };
      // min_stock hanya disertakan oleh admin (backend tolak kasir).
      if (isAdmin) body.min_stock = parseInt(form.min_stock, 10) || 0;

      if (isEdit) {
        if (isAdmin) body.alasan = alasan.trim();
        return productsApi.update(editing.id, body);
      }
      return productsApi.create(body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success(isEdit ? "Barang diperbarui" : "Barang ditambahkan");
      onClose();
    },
    onError: (e) => setErr(e.message),
  });

  function submit() {
    setErr("");
    mutation.mutate();
  }

  return {
    isEdit,
    form,
    set,
    alasan,
    setAlasan,
    err,
    submit,
    saving: mutation.isPending,
  };
}
