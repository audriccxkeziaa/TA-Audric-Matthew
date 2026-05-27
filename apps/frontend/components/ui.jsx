"use client";
// =================================================================
// components/ui.jsx — Komponen UI dasar (design system Tailwind)
// =================================================================
// Dipakai seluruh halaman supaya tampilan konsisten.
// =================================================================

import { useEffect } from "react";

// ---------- Tombol ----------
export function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  ...props
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-brand-600 text-white hover:bg-brand-700",
    secondary: "bg-slate-200 text-slate-800 hover:bg-slate-300",
    danger: "bg-red-600 text-white hover:bg-red-700",
    success: "bg-emerald-600 text-white hover:bg-emerald-700",
    ghost: "text-slate-600 hover:bg-slate-100",
    outline: "border border-slate-300 text-slate-700 hover:bg-slate-50",
  };
  const sizes = {
    sm: "px-2.5 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-5 py-2.5 text-base",
  };
  return (
    <button
      type={type}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

// ---------- Input teks ----------
export function Input({ label, error, className = "", ...props }) {
  return (
    <label className="block">
      {label && (
        <span className="mb-1 block text-sm font-medium text-slate-700">
          {label}
        </span>
      )}
      <input
        className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500 ${
          error ? "border-red-400" : "border-slate-300"
        } ${className}`}
        {...props}
      />
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

// ---------- Select ----------
export function Select({ label, children, className = "", ...props }) {
  return (
    <label className="block">
      {label && (
        <span className="mb-1 block text-sm font-medium text-slate-700">
          {label}
        </span>
      )}
      <select
        className={`w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500 ${className}`}
        {...props}
      >
        {children}
      </select>
    </label>
  );
}

// ---------- Kartu ----------
export function Card({ children, className = "" }) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

// ---------- Kartu metrik (dashboard) ----------
export function StatCard({ label, value, hint, tone = "default" }) {
  const tones = {
    default: "text-slate-900",
    good: "text-emerald-600",
    warn: "text-amber-600",
    bad: "text-red-600",
  };
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-bold ${tones[tone]}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </Card>
  );
}

// ---------- Badge ----------
export function Badge({ children, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    green: "bg-emerald-100 text-emerald-700",
    red: "bg-red-100 text-red-700",
    amber: "bg-amber-100 text-amber-700",
    blue: "bg-blue-100 text-blue-700",
    indigo: "bg-brand-100 text-brand-700",
  };
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

// ---------- Spinner ----------
export function Spinner({ label }) {
  return (
    <div className="flex flex-col items-center gap-2 text-slate-500">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-brand-600" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}

// ---------- Empty state ----------
export function EmptyState({ title = "Tidak ada data", description }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-12 text-center">
      <p className="text-sm font-medium text-slate-600">{title}</p>
      {description && (
        <p className="text-xs text-slate-400">{description}</p>
      )}
    </div>
  );
}

// ---------- Wadah halaman tinggi-penuh ----------
// Membuat halaman mengisi <main> dan mengatur area scroll sendiri,
// sehingga bagian penting (header/filter/ringkasan) tidak ikut ter-scroll.
export function PageShell({ children }) {
  return <div className="flex flex-col md:h-full">{children}</div>;
}

// ---------- Header halaman ----------
export function PageHeader({ title, description, actions }) {
  return (
    <div className="mb-3 flex shrink-0 flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        {description && (
          <p className="mt-0.5 text-sm text-slate-500">{description}</p>
        )}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

// ---------- Modal ----------
export function Modal({ open, onClose, title, children, width = "max-w-lg" }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose?.();
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/50"
        onClick={onClose}
      />
      <div
        className={`relative z-10 w-full ${width} max-h-[90vh] overflow-y-auto thin-scroll rounded-xl bg-white shadow-xl`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="font-semibold text-slate-900">{title}</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700"
            aria-label="Tutup"
          >
            ✕
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ---------- Dialog konfirmasi ----------
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = "Konfirmasi",
  message,
  confirmLabel = "Ya, lanjutkan",
  tone = "danger",
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} width="max-w-sm">
      <p className="text-sm text-slate-600">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Batal
        </Button>
        <Button variant={tone} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

// ---------- Skeleton loader ----------
export function Skeleton({ rows = 5 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-9 w-full animate-pulse rounded bg-slate-200"
        />
      ))}
    </div>
  );
}
