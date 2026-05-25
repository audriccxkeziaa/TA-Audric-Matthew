-- =================================================================
-- Migration 017 — Kolom kode_normalized untuk pencarian fleksibel
-- =================================================================
-- Menyimpan kode_barang tanpa tanda hubung dan huruf besar.
-- Contoh: "93306-002YR" → "93306002YR"
-- Kasir bisa mengetik "93306002yr" dan tetap menemukan produk.
-- =================================================================

ALTER TABLE products ADD COLUMN IF NOT EXISTS kode_normalized text
  GENERATED ALWAYS AS (UPPER(REPLACE(kode_barang, '-', ''))) STORED;

CREATE INDEX IF NOT EXISTS idx_products_kode_normalized ON products (kode_normalized);
