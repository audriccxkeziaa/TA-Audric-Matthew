-- Migration 043 — Default min_stock = 5
--
-- 1) Backfill: produk lama yang min_stock-nya masih 0 di-set ke 5 (default baru).
--    Filter `= 0` agar produk yang sudah pernah diatur admin tidak ikut tertimpa.
-- 2) Ubah default kolom jadi 5 untuk barang baru (admin tetap bebas mengubah).
--
-- Idempoten: UPDATE WHERE min_stock = 0 + SET DEFAULT aman dijalankan ulang.

UPDATE public.products SET min_stock = 5 WHERE min_stock = 0;

ALTER TABLE public.products ALTER COLUMN min_stock SET DEFAULT 5;
