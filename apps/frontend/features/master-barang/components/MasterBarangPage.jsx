"use client";
// /master-barang — CRUD Master Barang (kasir & admin)
// Orkestrator UI: merangkai hook useMasterBarang dengan sub-komponen.
// - Cari & filter (merk), scan barcode
// - Edit barang (admin). Kolom stok TIDAK bisa diedit manual (R3).

import { PageShell, PageHeader, Button } from "@/components/ui";
import { useMasterBarang } from "../hooks/useMasterBarang";
import { BarcodeSearch } from "./BarcodeSearch";
import { ProductFilters } from "./ProductFilters";
import { ProductTable } from "./ProductTable";
import { ProductFormModal } from "./ProductFormModal";
import { ProductViewModal } from "./ProductViewModal";

export default function MasterBarangPage() {
  const m = useMasterBarang();

  return (
    <PageShell>
      <PageHeader
        title="Master Barang"
        description="Halaman untuk mengelola data spareparts. Stok tidak dapat diubah manual."
      />

      <BarcodeSearch
        value={m.barcodeInput}
        onChange={m.setBarcodeInput}
        onSubmit={m.handleBarcodeSearch}
        inputRef={m.barcodeRef}
        showReset={Boolean(m.searchInput)}
        onReset={m.resetSearch}
      />

      <ProductFilters
        search={m.searchInput}
        onSearch={(v) => {
          m.setSearchInput(v);
          m.setPage(1);
        }}
        merkFilter={m.merkFilter}
        onMerk={(v) => {
          m.setMerkFilter(v);
          m.setPage(1);
        }}
        merkList={m.merkList}
      />

      <ProductTable
        products={m.products}
        isLoading={m.isLoading}
        isAdmin={m.isAdmin}
        page={m.page}
        onView={m.openView}
        onEdit={m.openEdit}
      />

      {m.total > 0 && (
        <div className="mt-2 flex shrink-0 items-center justify-between text-sm text-slate-500">
          <span>
            {m.total} items · page {m.page}/{m.totalPages}
          </span>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={m.page <= 1}
              onClick={() => m.setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={m.page >= m.totalPages}
              onClick={() => m.setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {m.showView && (
        <ProductViewModal
          open={m.showView}
          onClose={m.closeView}
          product={m.viewProduct}
        />
      )}

      {m.showForm && (
        <ProductFormModal
          key={m.editing?.id || "new"}
          open={m.showForm}
          editing={m.editing}
          isAdmin={m.isAdmin}
          onClose={m.closeForm}
        />
      )}
    </PageShell>
  );
}
