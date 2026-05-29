"use client";
// components/Sidebar.jsx — Navigasi samping, item difilter per role

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { adjustmentsApi } from "@/lib/api";

// Daftar menu. `roles` menentukan siapa yang boleh melihat item.
const NAV = [
  { href: "/dashboard", label: "Dashboard", roles: ["admin"], icon: "grid" },
  { href: "/kasir", label: "Kasir (POS)", roles: ["kasir"], icon: "cart" },
  {
    href: "/master-barang",
    label: "Master Barang",
    roles: ["admin", "kasir"],
    icon: "box",
  },
  {
    href: "/stok-masuk",
    label: "Stok Masuk",
    roles: ["kasir"],
    icon: "scan",
  },
  {
    href: "/retur-stok",
    label: "Retur & Penyesuaian",
    roles: ["kasir", "admin"],
    icon: "undo",
  },
  {
    href: "/dashboard/restock",
    label: "Rekomendasi Restock",
    roles: ["admin", "kasir"],
    icon: "alert",
  },
  { href: "/keuangan", label: "Keuangan", roles: ["admin"], icon: "money" },
  { href: "/laporan", label: "Laporan", roles: ["admin"], icon: "doc" },
  {
    href: "/audit-trail",
    label: "Audit Trail",
    roles: ["admin"],
    icon: "shield",
  },
  { href: "/users", label: "Manajemen User", roles: ["admin"], icon: "users" },
];

function Icon({ name }) {
  const paths = {
    grid: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
    cart: "M3 3h2l2 12h10l2-8H6M9 21a1 1 0 100-2 1 1 0 000 2zM17 21a1 1 0 100-2 1 1 0 000 2z",
    box: "M3 7l9-4 9 4-9 4-9-4zM3 7v10l9 4 9-4V7",
    scan: "M4 7V4h3M20 7V4h-3M4 17v3h3M20 17v3h-3M4 12h16",
    alert: "M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z",
    doc: "M6 2h9l5 5v15H6zM14 2v6h6",
    money: "M12 1v22M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6",
    shield: "M12 2l8 4v6c0 5-3.4 9.4-8 10-4.6-.6-8-5-8-10V6z",
    undo: "M3 10h10a5 5 0 010 10H9M3 10l4-4M3 10l4 4",
    users: "M9 11a4 4 0 100-8 4 4 0 000 8zM3 21v-1a6 6 0 0112 0v1M16 11a4 4 0 000-8",
  };
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name] || paths.box} />
    </svg>
  );
}

export default function Sidebar({ role, open, onClose }) {
  const pathname = usePathname();
  const items = NAV.filter((n) => n.roles.includes(role));

  const { data: pendingData } = useQuery({
    queryKey: ["notif-pending-approval"],
    queryFn: adjustmentsApi.pendingCount,
    refetchInterval: 30_000,
    enabled: role === "admin",
  });
  const pendingCount = pendingData?.count || 0;

  return (
    <>
      {/* Overlay mobile */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/50 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed z-40 flex h-screen w-60 flex-col bg-gradient-to-b from-brand-800 to-brand-900 text-white shadow-xl transition-transform md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand / logo */}
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white shadow-inner ring-1 ring-white/20">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7l9-4 9 4-9 4-9-4zM3 7v10l9 4 9-4V7" />
            </svg>
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold leading-tight">CV Asia Jaya Maju</p>
            <p className="text-[11px] text-white/60">Point of Sale System</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto thin-scroll px-3 py-4">
          {items.map((item) => {
            // Cocokkan rute aktif. /dashboard/restock jangan ikut menyalakan /dashboard.
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" &&
                pathname.startsWith(item.href + "/"));
            const showBadge = item.href === "/retur-stok" && pendingCount > 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                aria-current={active ? "page" : undefined}
                className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all ${
                  active
                    ? "bg-gradient-to-r from-brand-600/40 to-transparent font-semibold text-white shadow-[inset_2px_0_0_0_#818cf8]"
                    : "text-white/60 hover:bg-white/5 hover:text-white"
                }`}
              >
                {/* Accent bar saat aktif */}
                <span
                  className={`absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand-300 transition-opacity ${
                    active ? "opacity-100" : "opacity-0"
                  }`}
                />
                <span className={active ? "text-white" : "text-white/70 group-hover:text-white"}>
                  <Icon name={item.icon} />
                </span>
                <span className="flex-1">{item.label}</span>
                {showBadge && (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white shadow-sm">
                    {pendingCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 px-5 py-3 text-[11px] text-white/50">
          Skripsi S1 Informatika · UK Petra
        </div>
      </aside>
    </>
  );
}
