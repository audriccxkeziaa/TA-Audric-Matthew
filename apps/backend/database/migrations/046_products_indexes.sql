-- Migration 046 — Index performa untuk tabel products
-- Mempercepat query katalog (Browse kasir) & halaman master barang saat jumlah
-- produk bertambah ke ribuan. Idempoten (IF NOT EXISTS), aman dijalankan ulang.
--
-- Catatan: untuk 5.000-an baris PostgreSQL sebenarnya sudah cepat; index ini
-- menjaga performa tetap stabil saat data terus tumbuh (mis. puluhan ribu),
-- terutama untuk filter status + urut nama dan filter merk.

-- Filter status + urut nama_barang (query katalog & daftar master barang)
CREATE INDEX IF NOT EXISTS idx_products_status_nama
  ON products(status, nama_barang);

-- Filter berdasarkan merk
CREATE INDEX IF NOT EXISTS idx_products_merk
  ON products(merk);
