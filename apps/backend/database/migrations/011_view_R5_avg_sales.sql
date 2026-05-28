-- Migration 011 — Extend view v_restock_recommendation
-- Tambah kolom rata-rata penjualan 30 hari & estimasi habis stok.
-- Nilai dihitung dari sale_items × sales.created_at (>= NOW()-30d).
--
-- - avg_sales_30d        = total qty terjual / 30 (qty/hari, NUMERIC)
-- - total_sold_30d       = total qty terjual 30 hari terakhir
-- - n_transactions_30d   = jumlah transaksi unik yang menyentuh produk
-- - estimasi_hari_habis  = stok / avg_sales_30d (NULL bila avg = 0)
DROP VIEW IF EXISTS v_restock_recommendation CASCADE;

CREATE OR REPLACE VIEW v_restock_recommendation AS
WITH stat_30d AS (
  SELECT
    si.product_id,
    COALESCE(SUM(si.qty), 0)::INTEGER         AS total_sold_30d,
    COUNT(DISTINCT si.sale_id)::INTEGER       AS n_transactions_30d
  FROM sale_items si
  JOIN sales s ON s.id = si.sale_id
  WHERE s.created_at >= NOW() - INTERVAL '30 days'
  GROUP BY si.product_id
)
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
  p.status::text                AS status,
  ROUND(COALESCE(s30.total_sold_30d, 0)::NUMERIC / 30.0, 2) AS avg_sales_30d,
  COALESCE(s30.total_sold_30d, 0)            AS total_sold_30d,
  COALESCE(s30.n_transactions_30d, 0)        AS n_transactions_30d,
  CASE
    WHEN COALESCE(s30.total_sold_30d, 0) = 0 THEN NULL
    ELSE ROUND(p.stok::NUMERIC / (s30.total_sold_30d::NUMERIC / 30.0), 1)
  END                                        AS estimasi_hari_habis
FROM products p
LEFT JOIN stat_30d s30 ON s30.product_id = p.id
WHERE p.status = 'aktif' AND p.stok <= p.min_stock
ORDER BY
  CASE
    WHEN p.stok = 0 THEN 0
    WHEN p.stok <= CEIL(p.min_stock::numeric * 0.5) THEN 1
    ELSE 2
  END,
  (p.min_stock - p.stok) DESC;
