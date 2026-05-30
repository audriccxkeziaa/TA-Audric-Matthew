-- Migration 028 — Standardisasi Zona Waktu ke WITA (UTC+8)
-- Ganti Asia/Jakarta (WIB/UTC+7) → Asia/Makassar (WITA/UTC+8)
-- agar tanggal dalam kode dokumen akurat di wilayah WITA.

CREATE OR REPLACE FUNCTION fn_next_document_number(p_prefix TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_now     TIMESTAMPTZ := NOW() AT TIME ZONE 'Asia/Makassar';
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
