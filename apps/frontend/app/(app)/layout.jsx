"use client";
// (app)/layout.jsx — Kerangka aplikasi setelah login
// Route group "(app)" tidak mengubah URL — hanya membungkus seluruh
// halaman terproteksi dengan sidebar + topbar + penjaga akses (guard).
//   - Belum login            → redirect /login
//   - Kasir buka rute admin  → redirect /kasir

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { Spinner } from "@/components/ui";

// Prefix rute yang hanya boleh diakses admin.
const ADMIN_ONLY = [
  "/dashboard",
  "/laporan",
  "/audit-trail",
  "/users",
  "/keuangan",
];
// Rute khusus kasir (admin tidak butuh halaman POS / OCR).
const KASIR_ONLY = ["/kasir", "/stok-masuk"];

export default function AppLayout({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useRealtimeSync();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    // (RBAC) sisi klien — backend tetap re-check tiap request.
    // /dashboard/restock dikecualikan dari ADMIN_ONLY — kasir juga boleh baca.
    const isAdminRoute =
      ADMIN_ONLY.some((p) => pathname.startsWith(p)) &&
      !pathname.startsWith("/dashboard/restock");
    const isKasirRoute = KASIR_ONLY.some((p) => pathname.startsWith(p));
    if (isAdminRoute && user.role !== "admin") {
      router.replace("/kasir");
    } else if (isKasirRoute && user.role !== "kasir") {
      router.replace("/dashboard");
    }
  }, [user, loading, pathname, router]);

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner label="Memuat..." />
      </div>
    );
  }

  // Shell tinggi-viewport: tidak ada scroll global halaman. Tiap halaman
  // mengisi <main> dan mengatur sendiri area mana yang boleh scroll.
  return (
    <div className="h-screen overflow-hidden">
      <Sidebar
        role={user.role}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex h-full flex-col md:ml-60">
        <Topbar onToggleSidebar={() => setSidebarOpen((v) => !v)} />
        <main className="min-h-0 flex-1 overflow-auto p-4 md:overflow-hidden md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
