-- Migration 039 — Bucket nota-supplier: izinkan PDF + gambar
--
-- Root cause error 500 saat upload nota PDF: bucket 'nota-supplier' menolak
-- mimetype 'application/pdf' (allowed_mime_types tidak menyertakan PDF, di-set
-- via Dashboard; migrasi 004 sendiri tidak membatasi). Backend pakai
-- service_role (bypass RLS), jadi yang masih menolak adalah batasan bucket:
-- allowed_mime_types & file_size_limit.
--
-- Set eksplisit: terima JPG/PNG/WebP/PDF, batas 10 MB (samakan dengan multer).
-- Idempotent — aman dijalankan berkali-kali.

UPDATE storage.buckets
SET
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'application/pdf'
  ],
  file_size_limit = 10485760  -- 10 MB
WHERE id = 'nota-supplier';

-- Verifikasi (jalankan setelah UPDATE):
-- SELECT id, allowed_mime_types, file_size_limit FROM storage.buckets WHERE id = 'nota-supplier';
