"use client";
// /retur-stok — Retur & Penyesuaian Stok. Orkestrator tab.

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { PageShell, PageHeader } from "@/components/ui";
import { TabButton } from "./TabButton";
import { ReturSupplierForm } from "./ReturSupplierForm";
import { ReturPelangganForm } from "./ReturPelangganForm";
import { PenyesuaianStokForm } from "./PenyesuaianStokForm";
import { PendingApprovalTab } from "./PendingApprovalTab";
import { HistoryTab } from "./HistoryTab";

export default function ReturStokPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const TABS = [
    { id: "return_supplier", label: "Retur ke Supplier" },
    { id: "sales_return", label: "Retur Pelanggan" },
    ...(isAdmin ? [{ id: "stock_adjustment", label: "Penyesuaian Stok" }] : []),
    ...(isAdmin ? [{ id: "pending_approval", label: "Persetujuan Pending" }] : []),
    { id: "history", label: "Riwayat" },
  ];

  const [tab, setTab] = useState("return_supplier");

  return (
    <PageShell>
      <PageHeader
        title="Retur & Penyesuaian Stok"
        description="Kelola retur supplier, retur pelanggan, dan penyesuaian stok (penyusutan)"
      />

      {/* Tab bar */}
      <div className="mb-4 flex shrink-0 gap-1 rounded-lg bg-slate-100 p-1 overflow-x-auto">
        {TABS.map((t) => (
          <TabButton key={t.id} id={t.id} label={t.label} active={tab} onClick={setTab} />
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pb-4">
        {tab === "return_supplier" && <ReturSupplierForm />}
        {tab === "sales_return" && <ReturPelangganForm />}
        {tab === "stock_adjustment" && isAdmin && <PenyesuaianStokForm />}
        {tab === "pending_approval" && isAdmin && <PendingApprovalTab />}
        {tab === "history" && <HistoryTab />}
      </div>
    </PageShell>
  );
}
