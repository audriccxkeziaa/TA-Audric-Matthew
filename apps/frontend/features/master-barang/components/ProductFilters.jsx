"use client";
// Kartu filter pencarian: cari nama/kode + filter merk. Selalu terlihat.

import { Card, Input, Select } from "@/components/ui";

export function ProductFilters({
  search,
  onSearch,
  merkFilter,
  onMerk,
  merkList,
}) {
  return (
    <Card className="mb-3 shrink-0 p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          placeholder="Cari nama / kode barang..."
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
        <Select value={merkFilter} onChange={(e) => onMerk(e.target.value)}>
          <option value="">Semua Merk</option>
          {merkList.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </Select>
      </div>
    </Card>
  );
}
