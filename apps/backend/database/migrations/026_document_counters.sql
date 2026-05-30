-- Migration 026 — Penomoran Dokumen Sequential dengan Reset Tahunan
-- Format: [PREFIX]-YYYYMMDD-XXXX (4-digit, mulai 0000, reset tiap tahun baru)
-- Prefix: INV (kasir), RTP (retur pelanggan), RTS (retur supplier), ADJ (penyesuaian stok)
-- Tanggal & tahun menggunakan WIB (Asia/Jakarta) agar sesuai waktu operasional toko.

CREATE TABLE IF NOT EXISTS document_counters (
  prefix  TEXT NOT NULL,
  year    INT  NOT NULL,
  counter INT  NOT NULL DEFAULT 0,
  PRIMARY KEY (prefix, year)
);

CREATE INDEX IF NOT EXISTS idx_doc_counters_prefix_year ON document_counters(prefix, year);

-- fn_next_document_number: ambil nomor berikutnya secara atomis.
-- Counter mulai dari 0 (→ 0000) dan bertambah +1 tiap panggil.
-- Reset otomatis setiap berganti tahun karena PK mencakup year.
CREATE OR REPLACE FUNCTION fn_next_document_number(p_prefix TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_now     TIMESTAMPTZ := NOW() AT TIME ZONE 'Asia/Jakarta';
  v_year    INT         := EXTRACT(YEAR FROM v_now)::INT;
  v_date    TEXT        := TO_CHAR(v_now, 'YYYYMMDD');
  v_counter INT;
BEGIN
  INSERT INTO document_counters (prefix, year, counter)
    VALUES (p_prefix, v_year, 0)
    ON CONFLICT (prefix, year) DO UPDATE
      SET counter = document_counters.counter + 1
    RETURNING counter INTO v_counter;

  RETURN p_prefix || '-' || v_date || '-' || LPAD(v_counter::TEXT, 4, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION fn_next_document_number(TEXT)
  TO authenticated, service_role;
