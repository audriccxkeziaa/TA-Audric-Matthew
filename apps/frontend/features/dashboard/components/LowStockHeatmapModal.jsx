"use client";
// Modal heatmap stok menipis (klik kartu "Stok Menipis").

import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "@/lib/api";
import { angka } from "@/lib/format";
import { Modal, StatCard, Spinner, EmptyState } from "@/components/ui";
import { heatColor } from "../lib/dateRange";

export function LowStockHeatmapModal({ open, onClose }) {
  const q = useQuery({
    queryKey: ["dash-low"],
    queryFn: dashboardApi.lowStock,
    enabled: open,
  });
  const items = q.data?.data || [];
  const habis = items.filter((p) => p.level === "out").length;
  const low = items.filter((p) => p.level === "low").length;
  const warn = items.filter((p) => p.level === "warning").length;

  return (
    <Modal open={open} onClose={onClose} title="Heatmap Stok Menipis" width="max-w-5xl">
      {q.isLoading ? (
        <Spinner label="Memuat heatmap..." />
      ) : items.length === 0 ? (
        <EmptyState
          title="Semua stok aman"
          description="Tidak ada barang aktif di bawah ambang minimum."
        />
      ) : (
        <>
          <div className="mb-3 grid grid-cols-3 gap-3">
            <StatCard label="Stok Habis" value={angka(habis)} tone="bad" />
            <StatCard label="Di bawah min" value={angka(low)} tone="warn" />
            <StatCard label="Mendekati min" value={angka(warn)} />
          </div>
          <div className="mb-3 flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <span className="h-3 w-3 rounded bg-red-600" /> Habis
            </span>
            <span className="flex items-center gap-1">
              <span className="h-3 w-3 rounded bg-amber-500" /> Di bawah min
            </span>
            <span className="flex items-center gap-1">
              <span className="h-3 w-3 rounded bg-yellow-300" /> Mendekati min
            </span>
          </div>
          <div className="max-h-[60vh] overflow-auto thin-scroll">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {items.map((p) => (
                <div
                  key={p.id}
                  title={`${p.nama_barang} — stok ${p.stok}/${p.min_stock}`}
                  className={`rounded-lg p-2.5 ${heatColor(p.level)}`}
                >
                  <p className="truncate text-xs font-semibold">{p.nama_barang}</p>
                  <p className="truncate text-[10px] opacity-80">{p.kode_barang}</p>
                  <p className="mt-1 text-sm font-bold">
                    {angka(p.stok)}
                    <span className="text-[10px] font-normal opacity-80">
                      {" "}
                      / {angka(p.min_stock)}
                    </span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}
