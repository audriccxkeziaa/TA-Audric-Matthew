"use client";
// features/pengeluaran/hooks/usePengeluaran.js

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { expensesApi } from "@/lib/api";
import { useToast } from "@/hooks/useToast";
import { isoDate } from "@/lib/format";

export function usePengeluaran() {
  const qc = useQueryClient();
  const toast = useToast();

  // ── Filter jenis (client-side saja, tanpa filter periode) ──
  const [jenisFilter, setJenisFilter] = useState("all");

  // ── Form state ──
  const [jenis, setJenis] = useState("gaji");
  const [formTanggal, setFormTanggal] = useState(isoDate(0));
  const [nominal, setNominal] = useState("");
  const [deskripsi, setDeskripsi] = useState("");

  // ── Fetch semua riwayat pengeluaran (tanpa filter tanggal) ──
  const list = useQuery({
    queryKey: ["pengeluaran-page"],
    queryFn: () => expensesApi.list({ limit: 500 }),
    staleTime: 30_000,
  });

  const create = useMutation({
    mutationFn: (body) => expensesApi.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pengeluaran-page"] });
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["finance-summary"] });
      toast.success("Pengeluaran berhasil ditambahkan.");
      setNominal("");
      setDeskripsi("");
    },
    onError: (e) => toast.error(e.message || "Gagal menambahkan pengeluaran"),
  });

  const del = useMutation({
    mutationFn: (id) => expensesApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pengeluaran-page"] });
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["finance-summary"] });
      toast.success("Pengeluaran dihapus.");
    },
    onError: (e) => toast.error(e.message || "Gagal menghapus"),
  });

  const allRows = list.data?.data || [];

  const rows = useMemo(() => {
    if (jenisFilter === "all") return allRows;
    return allRows.filter((r) => r.jenis === jenisFilter);
  }, [allRows, jenisFilter]);

  const totalVisible = rows.reduce((s, r) => s + Number(r.nominal || 0), 0);

  function handleSubmit(e) {
    e.preventDefault();
    if (!deskripsi.trim()) return toast.error("Deskripsi wajib diisi");
    const val = Number(nominal);
    if (!nominal || val <= 0) return toast.error("Nominal harus lebih dari 0");
    create.mutate({
      jenis,
      tanggal: formTanggal,
      nominal: val,
      deskripsi: deskripsi.trim(),
    });
  }

  return {
    jenisFilter, setJenisFilter,
    list,
    rows,
    totalVisible,
    allCount: allRows.length,
    // form
    jenis, setJenis,
    formTanggal, setFormTanggal,
    nominal, setNominal,
    deskripsi, setDeskripsi,
    handleSubmit,
    creating: create.isPending,
    del,
  };
}
