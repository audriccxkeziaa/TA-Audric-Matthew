"use client";
// /audit-trail — Audit Trail stock_logs (admin). Orkestrator UI.
// Bukti Rule-Based System bekerja: tiap perubahan/penolakan stok tercatat.

import { PageShell, PageHeader, Button } from "@/components/ui";
import ProductPicker from "@/components/ProductPicker";
import { useAuditTrail } from "../hooks/useAuditTrail";
import { AuditFilters } from "./AuditFilters";
import { AuditTable } from "./AuditTable";
import { AuditDetailModal } from "./AuditDetailModal";

export default function AuditTrailPage() {
  const a = useAuditTrail();

  return (
    <PageShell>
      <PageHeader
        title="Audit Trail"
        description="Halaman untuk melihat detail setiap aksi & perubahan yang dilakukan oleh admin dan kasir."
        actions={
          <Button variant="outline" onClick={a.exportCsv}>
            Export CSV
          </Button>
        }
      />

      <AuditFilters
        filters={a.filters}
        setFilter={a.setFilter}
        users={a.users}
        productLabel={a.productLabel}
        onOpenPicker={() => a.setOpenPicker(true)}
        onClearProduct={() => {
          a.setFilter("product_id", "");
          a.setProductLabel("");
        }}
      />

      <AuditTable
        rows={a.rows}
        isLoading={a.isLoading}
        page={a.page}
        pageSize={a.pageSize}
        onRowClick={a.setDetailRow}
      />

      <div className="mt-2 flex shrink-0 items-center justify-between text-sm text-slate-500">
        <span>
          {a.total} items · page {a.page}/{a.totalPages}
          {a.isFetching && " · memuat..."}
        </span>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="outline"
            disabled={a.page <= 1}
            onClick={() => a.setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={a.page >= a.totalPages}
            onClick={() => a.setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>

      <AuditDetailModal
        detailRow={a.detailRow}
        onClose={() => a.setDetailRow(null)}
        isAdmin={a.user?.role === "admin"}
      />

      <ProductPicker
        open={a.openPicker}
        onClose={() => a.setOpenPicker(false)}
        onSelect={(p) => {
          a.setFilter("product_id", p.id);
          a.setProductLabel(p.nama_barang);
        }}
      />
    </PageShell>
  );
}
