"use client";
// features/pengeluaran/hooks/usePengeluaran.js

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { expensesApi } from "@/lib/api";
import { useToast } from "@/hooks/useToast";
import { isoDate } from "@/lib/format";
import { getPeriodRange } from "@/features/laporan/hooks/useLaporanTerpadu";

export function usePengeluaran() {
  const qc = useQueryClient();
  const toast = useToast();

  // ── Periode filter ──
  const [periodPreset, setPeriodPreset] = useState("bulan-ini");
  const [from, setFrom] = useState(() => getPeriodRange("bulan-ini").from);
  const [to, setTo] = useState(() => getPeriodRange("bulan-ini").to);
  const [jenisFilter, setJenisFilter] = useState("all");

  function applyPreset(preset) {
    setPeriodPreset(preset);
    if (preset !== "custom") {
      const range = getPeriodRange(preset);
      if (range) { setFrom(range.from); setTo(range.to); }
    }
  }

  // ── Form state ──
  const [jenis, setJenis] = useState("gaji");
  const [formTanggal, setFormTanggal] = useState(isoDate(0));
  const [nominal, setNominal] = useState("");
  const [deskripsi, setDeskripsi] = useState("");

  // ── Queries ──
  const list = useQuery({
    queryKey: ["pengeluaran-page", from, to],
    queryFn: () =>
      expensesApi.list({ ...(from ? { from } : {}), ...(to ? { to } : {}), limit: 500 }),
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
  const totalAll = allRows.reduce((s, r) => s + Number(r.nominal || 0), 0);

  function handleSubmit(e) {
    e.preventDefault();
    if (!deskripsi.trim()) return toast.error("Deskripsi wajib diisi");
    if (!nominal || Number(nominal) <= 0) return toast.error("Nominal harus lebih dari 0");
    create.mutate({
      jenis,
      tanggal: formTanggal,
      nominal: Number(nominal),
      deskripsi: deskripsi.trim(),
    });
  }

  function resetFilter() {
    applyPreset("bulan-ini");
    setJenisFilter("all");
  }

  return {
    periodPreset, applyPreset,
    from, setFrom, to, setTo,
    jenisFilter, setJenisFilter,
    resetFilter,
    list,
    rows,
    totalVisible,
    totalAll,
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
