"use client";
// Panel filter audit trail (selalu terlihat).

import { Card, Button, Input, Select } from "@/components/ui";

export function AuditFilters({
  filters,
  setFilter,
  users,
  productLabel,
  onOpenPicker,
  onClearProduct,
}) {
  return (
    <Card className="mb-3 shrink-0 p-3">
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        <Input
          label="Dari Tanggal"
          type="date"
          value={filters.from}
          onChange={(e) => setFilter("from", e.target.value)}
        />
        <Input
          label="Sampai Tanggal"
          type="date"
          value={filters.to}
          onChange={(e) => setFilter("to", e.target.value)}
        />
        <Select
          label="User"
          value={filters.user_id}
          onChange={(e) => setFilter("user_id", e.target.value)}
        >
          <option value="">Semua user</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.username} ({u.role})
            </option>
          ))}
        </Select>
        <Select
          label="Rule"
          value={filters.rule}
          onChange={(e) => setFilter("rule", e.target.value)}
        >
          <option value="">Semua rule</option>
          <option value="R1">R1 — Stok Negatif</option>
          <option value="R2">R2 — Validasi Stok Masuk</option>
          <option value="R3">R3 — Stok Terpusat</option>
          <option value="R4">R4 — Konsistensi Stok</option>
          <option value="R5">R5 — Rekomendasi Restock</option>
        </Select>
        <Select
          label="Aksi"
          value={filters.action}
          onChange={(e) => setFilter("action", e.target.value)}
        >
          <option value="">Semua aksi</option>
          <option value="TRIGGERED">TRIGGERED</option>
          <option value="REJECTED">REJECTED</option>
          <option value="ACCEPTED">ACCEPTED</option>
        </Select>
        <Select
          label="Sumber"
          value={filters.source_type}
          onChange={(e) => setFilter("source_type", e.target.value)}
        >
          <option value="">Semua sumber</option>
          <option value="sales">Penjualan</option>
          <option value="purchase">Stok Masuk</option>
          <option value="manual">Manual</option>
          <option value="adjustment">Retur/Penyesuaian</option>
        </Select>
        <div>
          <span className="mb-1 block text-sm font-medium text-slate-700">
            Produk
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="md"
              className="flex-1"
              onClick={onOpenPicker}
            >
              {productLabel || "Semua produk"}
            </Button>
            {filters.product_id && (
              <Button variant="ghost" size="md" onClick={onClearProduct}>
                ✕
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
