"use client";
// Kartu filter pencarian: cari nama/kode, filter merk (MerkPopup), kondisi stok, status produk.

import { Card, Input, Select } from "@/components/ui";
import { MerkPopup } from "@/components/MerkPopup";

export function ProductFilters({
  search,
  onSearch,
  merkFilter,
  onMerk,
  merkList,
  stockFilter,
  onStock,
  statusFilter,
  onStatus,
}) {
  return (
    <Card className="mb-3 shrink-0 p-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          placeholder="Cari nama / kode barang..."
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />

        {/* Filter merk via MerkPopup (searchable + buat baru) */}
        <MerkPopup
          value={merkFilter}
          onChange={onMerk}
          merkList={merkList}
          placeholder="Semua Merk"
          allowClear
        />

        {/* Filter kondisi stok */}
        <Select
          value={stockFilter}
          onChange={(e) => onStock(e.target.value)}
        >
          <option value="">Semua Kondisi</option>
          <option value="out">Stok Habis</option>
          <option value="critical">Stok Kritis</option>
          <option value="low">Stok Menipis</option>
          <option value="normal">Stok Normal</option>
        </Select>

        {/* Filter status produk (aktif / discontinue) */}
        <Select
          value={statusFilter}
          onChange={(e) => onStatus(e.target.value)}
        >
          <option value="aktif">Produk Aktif</option>
          <option value="nonaktif">Discontinue</option>
        </Select>
      </div>
    </Card>
  );
}
