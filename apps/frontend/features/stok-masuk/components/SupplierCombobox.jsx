"use client";
// Pemilih nama supplier — searchable + opsi "buat supplier baru" inline.
// Tipis: mendelegasikan ke SearchSelect (desain seragam dgn pemilih Merk).

import { SearchSelect } from "@/components/SearchSelect";

export function SupplierCombobox({ value, onChange, supplierList = [] }) {
  return (
    <SearchSelect
      value={value}
      onChange={onChange}
      options={supplierList}
      placeholder="Pilih atau ketik nama supplier..."
      allowCreate={true}
      createNoun="supplier"
      emptyText="Tidak ada supplier ditemukan"
    />
  );
}
