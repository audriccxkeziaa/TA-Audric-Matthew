-- =================================================================
-- Migration 007 — View R5 (Rekomendasi Restock) — versi awal
-- =================================================================
-- View ini dipakai endpoint GET /api/restock. Disempurnakan di
-- migrasi 011 dengan kolom avg_sales_30d & estimasi_hari_habis.
--
-- Tingkat urgensi:
--   HABIS    = stok = 0
--   KRITIS   = stok > 0 AND stok <= ceil(min_stock * 0.5)
--   MENIPIS  = stok > kritis AND stok <= min_stock
-- =================================================================

DROP VIEW IF EXISTS v_restock_recommendation CASCADE;

CREATE OR REPLACE VIEW v_restock_recommendation AS
SELECT
  p.id,
  p.kode_barang,
  p.nama_barang,
  p.merk,
  p.stok,
  p.min_stock,
  GREATEST(p.min_stock - p.stok, 0)::INTEGER AS kekurangan,
  CASE
    WHEN p.stok = 0 THEN 'HABIS'
    WHEN p.stok <= CEIL(p.min_stock::numeric * 0.5) THEN 'KRITIS'
    ELSE 'MENIPIS'
  END AS tingkat_urgensi,
  p.harga_beli,
  p.harga_jual,
  p.status::text AS status
FROM products p
WHERE p.status = 'aktif' AND p.stok <= p.min_stock
ORDER BY
  CASE
    WHEN p.stok = 0 THEN 0
    WHEN p.stok <= CEIL(p.min_stock::numeric * 0.5) THEN 1
    ELSE 2
  END,
  (p.min_stock - p.stok) DESC;
