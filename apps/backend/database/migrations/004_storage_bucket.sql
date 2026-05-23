-- =================================================================
-- Migration 004 — Storage Bucket "nota-supplier"
-- =================================================================
-- Bucket private untuk menyimpan file nota supplier (JPG/PNG/PDF).
-- Akses hanya lewat service-role key dari backend (signed URL ke FE).
-- =================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('nota-supplier', 'nota-supplier', false)
ON CONFLICT (id) DO NOTHING;

-- Hapus policy lama (jika ada) lalu set ulang — service role bypass RLS,
-- jadi policy ini relevan kalau nanti diakses dari client. Default: tutup.
DROP POLICY IF EXISTS nota_supplier_no_anon_read   ON storage.objects;
DROP POLICY IF EXISTS nota_supplier_no_anon_write  ON storage.objects;
