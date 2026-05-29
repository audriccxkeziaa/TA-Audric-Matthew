"use client";
// features/keuangan/hooks/useExpenseForm.js — state form + mutation tambah/edit
// pengeluaran operasional. Validasi dipindahkan apa adanya.

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { expensesApi } from "@/lib/api";
import { useToast } from "@/hooks/useToast";
import { DESKRIPSI_HINT } from "../lib/constants";

export function useExpenseForm({ editing, onClose }) {
  const qc = useQueryClient();
  const toast = useToast();
  const isEdit = Boolean(editing);
  const today = new Date().toISOString().slice(0, 10);

  const [jenis, setJenis] = useState(editing?.jenis || "gaji");
  const [deskripsi, setDeskripsi] = useState(editing?.deskripsi || "");
  const [nominal, setNominal] = useState(
    editing?.nominal != null ? String(editing.nominal) : ""
  );
  const [tgl, setTgl] = useState(editing?.tanggal || today);
  const [err, setErr] = useState("");

  const hint = DESKRIPSI_HINT[jenis] || DESKRIPSI_HINT.custom;

  const mut = useMutation({
    mutationFn: async () => {
      const n = Number(nominal);
      if (!deskripsi.trim()) throw new Error(`${hint.label} wajib diisi`);
      if (!Number.isFinite(n) || n <= 0)
        throw new Error("Nominal harus angka > 0");
      const payload = {
        jenis,
        deskripsi: deskripsi.trim(),
        nominal: n,
        tanggal: tgl,
      };
      if (isEdit) return expensesApi.update(editing.id, payload);
      return expensesApi.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["finance-summary"] });
      toast.success(
        isEdit
          ? "Pengeluaran Operasional diperbarui"
          : "Pengeluaran Operasional dicatat"
      );
      onClose();
    },
    onError: (e) => setErr(e.message),
  });

  function submit() {
    setErr("");
    mut.mutate();
  }

  return {
    isEdit,
    jenis,
    setJenis,
    deskripsi,
    setDeskripsi,
    nominal,
    setNominal,
    tgl,
    setTgl,
    err,
    hint,
    submit,
    saving: mut.isPending,
  };
}
