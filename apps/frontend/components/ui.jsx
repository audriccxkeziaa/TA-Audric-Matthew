"use client";
// components/ui.jsx — Komponen UI dasar (design system Tailwind)
// Dipakai seluruh halaman supaya tampilan konsisten & profesional.
// Catatan: API/props tiap komponen dijaga backward-compatible.

import { useEffect } from "react";

// ---------- Spinner inline kecil (untuk tombol loading) ----------
function InlineSpinner({ className = "h-4 w-4" }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}

// ---------- Tombol ----------
export function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  loading = false,
  disabled = false,
  ...props
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200 active:scale-95 focus:outline-none focus:ring-2 focus:ring-brand-500/50 disabled:cursor-not-allowed disabled:opacity-60" +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-white " +
    "active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100";
  const variants = {
    primary:
      "bg-brand-600 text-white shadow-sm hover:bg-brand-700 hover:shadow focus-visible:ring-brand-500",
    secondary:
      "bg-slate-100 text-slate-800 ring-1 ring-inset ring-slate-200 hover:bg-slate-200 focus-visible:ring-slate-400",
    danger:
      "bg-red-600 text-white shadow-sm hover:bg-red-700 hover:shadow focus-visible:ring-red-500",
    success:
      "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 hover:shadow focus-visible:ring-emerald-500",
    ghost: "text-slate-600 hover:bg-slate-100 focus-visible:ring-slate-300",
    outline:
      "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400 focus-visible:ring-brand-500",
  };
  const sizes = {
    sm: "px-2.5 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-5 py-2.5 text-base",
  };
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {loading && <InlineSpinner className={size === "lg" ? "h-5 w-5" : "h-4 w-4"} />}
      {children}
    </button>
  );
}

// // ---------- Field dasar (label + pesan error) ----------
// const FIELD_BASE =
//   "w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm " +
//   "placeholder:text-slate-400 transition-colors " +
//   "hover:border-slate-400 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 " +
//   "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";
// ---------- Field dasar (ganti FIELD_BASE yang lama dengan ini) ----------
const FIELD_BASE =
  "w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm text-slate-900 shadow-sm " +
  "placeholder:text-slate-400 transition-all duration-200 " +
  "hover:bg-white hover:border-slate-300 " +
  "focus:outline-none focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 " +
  "disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500";

// ---------- Input teks ----------
export function Input({ label, error, className = "", ...props }) {
  // Cegah scroll mouse mengubah nilai input number. Saat field number ter-fokus
  // lalu user men-scroll, browser diam-diam menaik/menurunkan angka (step ±1) —
  // mis. harga 25000 berubah jadi 24999/24998. Blur saat wheel mematikan itu.
  function handleWheel(e) {
    if (props.type === "number") e.currentTarget.blur();
    props.onWheel?.(e);
  }
  return (
    <label className="block">
      {label && (
        <span className="mb-1.5 block text-sm font-medium text-slate-700">
          {label}
        </span>
      )}
      <input
        className={`${FIELD_BASE} ${error ? "border-red-400 focus:border-red-500 focus:ring-red-500/30" : "border-slate-300"} ${className}`}
        {...props}
        onWheel={handleWheel}
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
        <span className="mb-1.5 block text-sm font-medium text-slate-700">
          {label}
        </span>
      )}
      <select
        className={`${FIELD_BASE} border-slate-300 cursor-pointer pr-9 ${className}`}
        {...props}
      >
        {children}
      </select>
    </label>
  );
}

// ---------- Textarea ----------
export function Textarea({ label, error, className = "", rows = 3, ...props }) {
  return (
    <label className="block">
      {label && (
        <span className="mb-1.5 block text-sm font-medium text-slate-700">
          {label}
        </span>
      )}
      <textarea
        rows={rows}
        className={`${FIELD_BASE} resize-y ${error ? "border-red-400 focus:border-red-500 focus:ring-red-500/30" : "border-slate-300"} ${className}`}
        {...props}
      />
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

// ---------- Kartu ----------
export function Card({ children, className = "", hover = false }) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white shadow-card ${
        hover ? "transition-shadow hover:shadow-card-hover" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

// // ---------- Kartu metrik (dashboard) ----------
// export function StatCard({ label, value, hint, tone = "default", icon }) {
//   const tones = {
//     default: "text-slate-900",
//     good: "text-emerald-600",
//     warn: "text-amber-600",
//     bad: "text-red-600",
//   };
//   const iconTones = {
//     default: "bg-brand-50 text-brand-600",
//     good: "bg-emerald-50 text-emerald-600",
//     warn: "bg-amber-50 text-amber-600",
//     bad: "bg-red-50 text-red-600",
//   };
//   return (
//     <Card className="p-4" hover>
//       <div className="flex items-start justify-between gap-3">
//         <div className="min-w-0">
//           <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
//             {label}
//           </p>
//           <p className={`mt-1.5 text-2xl font-bold tracking-tight ${tones[tone]}`}>
//             {value}
//           </p>
//           {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
//         </div>
//         {icon && (
//           <span
//             className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconTones[tone]}`}
//           >
//             {icon}
//           </span>
//         )}
//       </div>
//     </Card>
//   );
// }

// ---------- Kartu metrik (ganti fungsi StatCard yang lama dengan ini) ----------
export function StatCard({ label, value, hint, tone = "default", icon, accent = false }) {
  const tones = {
    default: "text-slate-900",
    good: "text-emerald-600",
    warn: "text-amber-600",
    bad: "text-red-600",
  };
  const iconTones = {
    default: "bg-brand-50/50 text-brand-600 ring-1 ring-brand-100/50",
    good: "bg-emerald-50/50 text-emerald-600 ring-1 ring-emerald-100/50",
    warn: "bg-amber-50/50 text-amber-600 ring-1 ring-amber-100/50",
    bad: "bg-red-50/50 text-red-600 ring-1 ring-red-100/50",
  };
  const accentBg = {
    default: "bg-brand-600",
    good: "bg-emerald-600",
    warn: "bg-amber-600",
    bad: "bg-red-600",
  };

  if (accent) {
    return (
      <div className={`rounded-xl p-4 shadow-card ${accentBg[tone]}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-white/70">
              {label}
            </p>
            <p className="mt-1.5 text-2xl font-bold tracking-tight text-white">
              {value}
            </p>
            {hint && <p className="mt-1 text-xs text-white/60">{hint}</p>}
          </div>
          {icon && (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/20 text-white">
              {icon}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <Card className="p-4" hover>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {label}
          </p>
          <p className={`mt-1.5 text-2xl font-bold tracking-tight ${tones[tone]}`}>
            {value}
          </p>
          {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
        </div>
        {icon && (
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconTones[tone]}`}
          >
            {icon}
          </span>
        )}
      </div>
    </Card>
  );
}

// ---------- Badge ----------
export function Badge({ children, tone = "slate", dot = false }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    red: "bg-red-50 text-red-700 ring-red-200",
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
    blue: "bg-blue-50 text-blue-700 ring-blue-200",
    indigo: "bg-brand-50 text-brand-700 ring-brand-200",
    orange: "bg-orange-50 text-orange-700 ring-orange-200",
    cyan: "bg-cyan-50 text-cyan-700 ring-cyan-200",
  };
  const dotTones = {
    slate: "bg-slate-400",
    green: "bg-emerald-500",
    red: "bg-red-500",
    amber: "bg-amber-500",
    blue: "bg-blue-500",
    indigo: "bg-brand-500",
    orange: "bg-orange-500",
    cyan: "bg-cyan-500",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${tones[tone]}`}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dotTones[tone]}`} />}
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
export function EmptyState({ title = "Tidak ada data", description, icon, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      {icon && (
        <span className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          {icon}
        </span>
      )}
      <p className="text-sm font-medium text-slate-600">{title}</p>
      {description && <p className="max-w-xs text-xs text-slate-400">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
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
    <div className="mb-4 flex shrink-0 flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      <div
        className={`relative w-full ${width} transform overflow-hidden rounded-xl bg-white text-left shadow-2xl transition-all sm:my-8`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-5 py-3.5 backdrop-blur">
          <h2 className="font-semibold text-slate-900">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
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
  confirmLabel = "Yes, confirm",
  tone = "danger",
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} width="max-w-sm">
      <p className="text-sm text-slate-600">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
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
    <div className="space-y-2.5">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="skeleton-shimmer h-9 w-full rounded-lg bg-slate-200/70"
        />
      ))}
    </div>
  );
}


// ---------- Tabel (design system) ----------
// Membungkus pola tabel data yang berulang (header sticky + hover row) sesuai
// design system. Pemakaian dual-view: <Table> (default desktopOnly) untuk tabel
// yang disandingkan dengan kartu mobile (md:hidden). Set desktopOnly={false}
// untuk tabel yang tampil di semua ukuran (mis. di dalam modal).
export function Table({ children, className = "", desktopOnly = true }) {
  return (
    <table
      className={`w-full text-sm ${desktopOnly ? "hidden md:table" : ""} ${className}`}
    >
      {children}
    </table>
  );
}

export function THead({ children, className = "" }) {
  return (
    <thead
      className={`sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 ${className}`}
    >
      <tr>{children}</tr>
    </thead>
  );
}

export function TH({ children, className = "", ...props }) {
  return (
    <th className={`px-4 py-2.5 ${className}`} {...props}>
      {children}
    </th>
  );
}

export function TBody({ children, className = "" }) {
  return (
    <tbody className={`divide-y divide-slate-100 ${className}`}>{children}</tbody>
  );
}

export function TR({ children, className = "", onClick, ...props }) {
  return (
    <tr
      onClick={onClick}
      className={`transition-colors hover:bg-brand-50/40 ${onClick ? "cursor-pointer" : ""} ${className}`}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TD({ children, className = "", ...props }) {
  return (
    <td className={`px-4 py-2.5 ${className}`} {...props}>
      {children}
    </td>
  );
}

// ---------- Tabs ----------
export function Tabs({ tabs, activeTab, onTabChange, className = "" }) {
  return (
    <div className={`flex border-b border-slate-200 ${className}`}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onTabChange(tab.id)}
          className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
            activeTab === tab.id
              ? "border-brand-600 text-brand-700"
              : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
          }`}
        >
          {tab.label}
          {tab.count != null && (
            <span
              className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                activeTab === tab.id
                  ? "bg-brand-100 text-brand-700"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
