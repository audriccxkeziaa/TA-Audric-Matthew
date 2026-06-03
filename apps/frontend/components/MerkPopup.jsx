"use client";
// Pemilih merk — searchable + opsi "buat merk baru" inline.
// Tipis: mendelegasikan ke SearchSelect (desain seragam dgn pemilih Supplier).
// Dipakai di stok-masuk/ItemRow, master-barang/ProductFormModal & ProductFilters.
// Mode filter (allowClear) otomatis menonaktifkan opsi "buat baru".

import { SearchSelect } from "./SearchSelect";

export function MerkPopup({
  value,
  onChange,
  merkList = [],
  disabled = false,
  placeholder = "Pilih merk...",
  allowClear = false,
}) {
  return (
    <SearchSelect
      value={value}
      onChange={onChange}
      options={merkList}
      disabled={disabled}
      placeholder={placeholder}
      allowClear={allowClear}
      clearLabel="Semua Merk"
      allowCreate={!allowClear}
      createNoun="merk"
      emptyText="Tidak ada merk ditemukan"
    />
  );
}
