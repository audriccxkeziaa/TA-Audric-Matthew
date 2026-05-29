"use client";
// Modal BAYAR — input uang diterima, hitung kembalian otomatis, quick cash.
// State lokal (tunai) tetap di sini karena murni UI modal pembayaran.

import { useState, useRef, useEffect, useMemo } from "react";
import { Modal, Button } from "@/components/ui";
import { rupiah } from "@/lib/format";

export function BayarModal({ open, onClose, total, cart, onConfirm, processing }) {
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
            {cart.length} jenis · {cart.reduce((s, x) => s + x.qty, 0)} item
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
            Cancel (Esc)
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
