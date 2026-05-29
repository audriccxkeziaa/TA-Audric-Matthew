"use client";
// Tombol tab. Khusus tab "pending_approval" menampilkan badge jumlah pending
// dengan polling 30 detik.

import { useQuery } from "@tanstack/react-query";
import { adjustmentsApi } from "@/lib/api";

export function TabButton({ id, label, active, onClick }) {
  const { data: pendingData } = useQuery({
    queryKey: ["notif-pending-approval"],
    queryFn: adjustmentsApi.pendingCount,
    refetchInterval: 30_000,
    staleTime: 10_000,
    enabled: id === "pending_approval",
  });
  const pendingCount = id === "pending_approval" ? pendingData?.count || 0 : 0;

  return (
    <button
      onClick={() => onClick(id)}
      className={`relative flex-shrink-0 rounded-md px-3 py-2 text-sm font-medium transition whitespace-nowrap ${
        active === id
          ? "bg-white text-slate-900 shadow-sm"
          : "text-slate-500 hover:text-slate-700"
      }`}
    >
      {label}
      {pendingCount > 0 && (
        <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">
          {pendingCount}
        </span>
      )}
    </button>
  );
}
