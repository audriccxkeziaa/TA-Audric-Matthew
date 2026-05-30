-- =======================================================================
-- RETROACTIVE RENUMBERING — Format ulang kode lama ke sequential baru
-- =======================================================================
-- PRASYARAT  : Migration 026 (document_counters + fn_next_document_number)
--              SUDAH dijalankan di Supabase SQL Editor.
-- JALANKAN   : SEKALI SAJA di Supabase SQL Editor.
-- IDEMPOTEN? : TIDAK — jangan dijalankan dua kali.
-- AMAN?      : Ya — kode lama hanya kolom display, FK antar tabel pakai UUID.
-- =======================================================================

BEGIN;

-- -----------------------------------------------------------------------
-- 1. UPDATE sales.kode_transaksi  (prefix INV)
--    Urutkan per tahun (WIB) berdasarkan created_at ASC.
--    Dokumen tertua dalam 1 tahun → 0000, berikutnya 0001, dst.
-- -----------------------------------------------------------------------
WITH numbered AS (
  SELECT
    id,
    TO_CHAR(created_at AT TIME ZONE 'Asia/Jakarta', 'YYYYMMDD') AS date_str,
    (ROW_NUMBER() OVER (
      PARTITION BY EXTRACT(YEAR FROM created_at AT TIME ZONE 'Asia/Jakarta')
      ORDER BY created_at ASC, id ASC
    ) - 1) AS seq_num
  FROM sales
)
UPDATE sales s
SET kode_transaksi = 'INV-' || n.date_str || '-' || LPAD(n.seq_num::TEXT, 4, '0')
FROM numbered n
WHERE s.id = n.id;

-- -----------------------------------------------------------------------
-- 2. UPDATE stock_adjustments.kode_adjustment  (prefix RTP / RTS / ADJ)
--    Counter terpisah per tipe, reset per tahun.
-- -----------------------------------------------------------------------
WITH numbered AS (
  SELECT
    id,
    CASE type
      WHEN 'sales_return'     THEN 'RTP'
      WHEN 'return_supplier'  THEN 'RTS'
      WHEN 'stock_adjustment' THEN 'ADJ'
      ELSE 'ADJ'
    END AS prefix,
    TO_CHAR(created_at AT TIME ZONE 'Asia/Jakarta', 'YYYYMMDD') AS date_str,
    (ROW_NUMBER() OVER (
      PARTITION BY
        type,
        EXTRACT(YEAR FROM created_at AT TIME ZONE 'Asia/Jakarta')
      ORDER BY created_at ASC, id ASC
    ) - 1) AS seq_num
  FROM stock_adjustments
)
UPDATE stock_adjustments sa
SET kode_adjustment = n.prefix || '-' || n.date_str || '-' || LPAD(n.seq_num::TEXT, 4, '0')
FROM numbered n
WHERE sa.id = n.id;

-- -----------------------------------------------------------------------
-- 3. SEED document_counters dengan nilai terakhir yang sudah dipakai,
--    agar dokumen baru berikutnya tidak tabrakan dengan data lama.
--    counter = (jumlah dokumen dalam tahun itu) - 1   ← 0-based index
-- -----------------------------------------------------------------------

-- Seed INV dari sales
INSERT INTO document_counters (prefix, year, counter)
SELECT
  'INV',
  EXTRACT(YEAR FROM created_at AT TIME ZONE 'Asia/Jakarta')::INT AS yr,
  COUNT(*) - 1
FROM sales
GROUP BY yr
ON CONFLICT (prefix, year) DO UPDATE
  SET counter = GREATEST(document_counters.counter, EXCLUDED.counter);

-- Seed RTP dari stock_adjustments type=sales_return
INSERT INTO document_counters (prefix, year, counter)
SELECT
  'RTP',
  EXTRACT(YEAR FROM created_at AT TIME ZONE 'Asia/Jakarta')::INT AS yr,
  COUNT(*) - 1
FROM stock_adjustments
WHERE type = 'sales_return'
GROUP BY yr
ON CONFLICT (prefix, year) DO UPDATE
  SET counter = GREATEST(document_counters.counter, EXCLUDED.counter);

-- Seed RTS dari stock_adjustments type=return_supplier
INSERT INTO document_counters (prefix, year, counter)
SELECT
  'RTS',
  EXTRACT(YEAR FROM created_at AT TIME ZONE 'Asia/Jakarta')::INT AS yr,
  COUNT(*) - 1
FROM stock_adjustments
WHERE type = 'return_supplier'
GROUP BY yr
ON CONFLICT (prefix, year) DO UPDATE
  SET counter = GREATEST(document_counters.counter, EXCLUDED.counter);

-- Seed ADJ dari stock_adjustments type=stock_adjustment
INSERT INTO document_counters (prefix, year, counter)
SELECT
  'ADJ',
  EXTRACT(YEAR FROM created_at AT TIME ZONE 'Asia/Jakarta')::INT AS yr,
  COUNT(*) - 1
FROM stock_adjustments
WHERE type = 'stock_adjustment'
GROUP BY yr
ON CONFLICT (prefix, year) DO UPDATE
  SET counter = GREATEST(document_counters.counter, EXCLUDED.counter);

COMMIT;

-- -----------------------------------------------------------------------
-- Verifikasi (jalankan setelah COMMIT untuk memastikan hasilnya benar):
-- -----------------------------------------------------------------------
-- SELECT kode_transaksi, created_at FROM sales ORDER BY created_at ASC LIMIT 10;
-- SELECT kode_adjustment, type, created_at FROM stock_adjustments ORDER BY created_at ASC LIMIT 10;
-- SELECT * FROM document_counters ORDER BY prefix, year;
