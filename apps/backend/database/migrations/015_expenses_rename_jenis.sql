-- Migration 015 — Rename enum expense_kind
-- Permintaan user:
--   'sewa'    -> 'supplier'  (pembelian dari supplier yang tidak via OCR)
--   'lainnya' -> 'custom'    (pengeluaran custom dengan deskripsi bebas)
--
-- PostgreSQL 10+ mendukung ALTER TYPE … RENAME VALUE — aman dijalankan
-- walau ada data eksisting (label berubah, ID enum di-preserve).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'sewa'
      AND enumtypid = 'expense_kind'::regtype
  ) THEN
    EXECUTE 'ALTER TYPE expense_kind RENAME VALUE ''sewa'' TO ''supplier''';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'lainnya'
      AND enumtypid = 'expense_kind'::regtype
  ) THEN
    EXECUTE 'ALTER TYPE expense_kind RENAME VALUE ''lainnya'' TO ''custom''';
  END IF;
END $$;
