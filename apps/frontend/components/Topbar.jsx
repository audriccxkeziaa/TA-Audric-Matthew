"use client";
// components/Topbar.jsx — Bar atas: notifikasi stok menipis + pending approval + profil

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { notificationsApi, adjustmentsApi } from "@/lib/api";
import { Badge } from "@/components/ui";
import { angka } from "@/lib/format";

export default function Topbar({ onToggleSidebar }) {
  const { user, logout } = useAuth();
  const [openNotif, setOpenNotif] = useState(false);

  // Notifikasi stok menipis — polling tiap 60 detik (admin & kasir).
  const { data } = useQuery({
    queryKey: ["notif-low-stock"],
    queryFn: notificationsApi.lowStock,
    refetchInterval: 60 * 1000,
  });
  const count = data?.count || 0;
  const items = data?.items || [];

  // Notifikasi pending approval — realtime via stock_adjustments subscription
  const { data: pendingData } = useQuery({
    queryKey: ["notif-pending-approval"],
    queryFn: adjustmentsApi.pendingCount,
    refetchInterval: 30 * 1000,
    enabled: user?.role === "admin",
  });
  const pendingCount = pendingData?.count || 0;

  const totalBadge = count + pendingCount;

  const initials = (user?.username || "?")
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="z-20 flex shrink-0 items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-2.5 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/80 no-print">
      {/* Kiri: hamburger (mobile) */}
      <button
        onClick={onToggleSidebar}
        className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
        aria-label="Menu"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
      </button>

      <div className="hidden text-sm font-medium text-slate-400 md:block">
        Sistem Persediaan & Penjualan
      </div>

      {/* Kanan: notifikasi + profil */}
      <div className="flex items-center gap-2">
        {/* Lonceng notifikasi */}
        <div className="relative">
          <button
            onClick={() => setOpenNotif((v) => !v)}
            className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100"
            aria-label="Notifikasi"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" />
            </svg>
            {totalBadge > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                {totalBadge > 99 ? "99+" : totalBadge}
              </span>
            )}
          </button>

          {openNotif && (
            <div className="absolute right-0 z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] origin-top-right overflow-hidden rounded-xl border border-slate-200 bg-white shadow-pop animate-slide-down">
              {/* Pending Approval (admin only) */}
              {user?.role === "admin" && pendingCount > 0 && (
                <>
                  <div className="border-b border-slate-100 px-4 py-2.5 text-sm font-semibold text-amber-700 bg-amber-50">
                    Menunggu Persetujuan ({pendingCount})
                  </div>
                  <a
                    href="/retur-stok"
                    className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-sm text-amber-700 hover:bg-amber-50"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 9v4M12 17h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>
                      {pendingCount} retur pelanggan menunggu persetujuan Anda
                    </span>
                  </a>
                </>
              )}

              {/* Stok Menipis */}
              <div className="border-b border-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700">
                Stok Menipis ({count})
              </div>
              <div className="max-h-72 overflow-y-auto thin-scroll">
                {items.length === 0 ? (
                  <p className="px-4 py-6 text-center text-xs text-slate-400">
                    Semua stok aman.
                  </p>
                ) : (
                  items.map((it) => (
                    <div
                      key={it.id}
                      className="flex items-start gap-3 border-b border-slate-50 px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer last:border-0"
                    >
                      {/* Ikon Indikator */}
                      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${it.level === 'habis' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-700">
                          {it.nama_barang}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          KODE: {it.kode_barang}
                        </p>
                      </div>
                      <div className="shrink-0 pt-1">
                      <Badge tone={it.level === "habis" ? "red" : "amber"}>
                        {angka(it.stok)}/{angka(it.min_stock)}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

        {/* Profil + logout */}
        <div className="flex items-center gap-2.5 border-l border-slate-200 pl-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-bold text-white shadow-sm ring-1 ring-brand-700/20">
            {initials}
          </span>
          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold leading-tight text-slate-800">
              {user?.username || "—"}
            </p>
            <p className="text-xs capitalize text-slate-400">{user?.role}</p>
          </div>
          <button
            onClick={logout}
            className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
