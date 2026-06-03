-- =======================================================================
-- RESET FRESH START — Kosongkan SELURUH data, anggap program baru
-- =======================================================================
-- TUJUAN     : Bersihkan semua data transaksi + master barang + user,
--              sisakan HANYA akun "superadmin" (role admin, password
--              superadmin123). Untuk go-live / mulai input data real di toko.
--
-- JALANKAN   : Supabase SQL Editor.  SEKALI SAJA.
-- IRREVERSIBLE: TIDAK BISA di-undo. Pastikan tidak ada data yang masih
--               dibutuhkan. Backup dulu (Database > Backups) bila ragu.
-- PRASYARAT  : User "superadmin" (role='admin') SUDAH ada. Jika tidak,
--              script SENGAJA gagal di awal agar tidak menghapus semua akun.
--
-- Yang DIHAPUS TOTAL:
--   sales, sale_items, purchases, purchase_items,
--   stock_adjustments, stock_adjustment_items, stock_logs,
--   expenses, purchase_drafts, document_counters, products,
--   serta SEMUA user kecuali superadmin (auth.users + public.users).
-- Yang DIPERTAHANKAN:
--   Akun superadmin saja (profil + kredensial).
-- =======================================================================

BEGIN;

-- -----------------------------------------------------------------------
-- 0) GUARD — batalkan kalau superadmin tidak ada (cegah hapus semua akun)
-- -----------------------------------------------------------------------
DO $$
DECLARE v_id UUID;
BEGIN
  SELECT id INTO v_id
  FROM public.users
  WHERE username = 'superadmin' AND role = 'admin';

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'STOP: user "superadmin" (role=admin) tidak ditemukan. Script dibatalkan agar tidak menghapus semua akun. Buat dulu akun superadmin, lalu ulangi.';
  END IF;
END $$;

-- -----------------------------------------------------------------------
-- 1) WIPE semua data transaksi + master barang + counter dokumen
--    CASCADE menuntaskan tabel anak (sale_items, purchase_items,
--    stock_adjustment_items). products ikut kosong total.
--    TRUNCATE tidak menjalankan trigger R3/R4 → aman, stok ikut hilang.
-- -----------------------------------------------------------------------
TRUNCATE TABLE
  sale_items,
  sales,
  purchase_items,
  purchases,
  stock_adjustment_items,
  stock_adjustments,
  stock_logs,
  expenses,
  purchase_drafts,
  document_counters,
  products
CASCADE;

-- -----------------------------------------------------------------------
-- 2) HAPUS semua user KECUALI superadmin
--    Hapus dari auth.users → public.users ikut terhapus
--    (ON DELETE CASCADE, lihat migrasi 001). FK RESTRICT dari sales/
--    purchases/stock_logs/dst sudah tidak menghalangi karena tabelnya
--    sudah dikosongkan di langkah (1).
-- -----------------------------------------------------------------------
DELETE FROM auth.users
WHERE id <> (SELECT id FROM public.users WHERE username = 'superadmin');

-- -----------------------------------------------------------------------
-- 3) Pastikan superadmin aktif & role admin
-- -----------------------------------------------------------------------
UPDATE public.users
SET role = 'admin', is_active = TRUE
WHERE username = 'superadmin';

COMMIT;

-- =======================================================================
-- 4) (OPSIONAL) Reset password superadmin = "superadmin123"
-- -----------------------------------------------------------------------
-- Lewati blok ini jika password superadmin SUDAH superadmin123.
-- Jika dijalankan dan ERROR "function crypt/gen_salt does not exist",
-- ganti `crypt`/`gen_salt` jadi `extensions.crypt`/`extensions.gen_salt`,
-- atau pakai cara teraman: Supabase Dashboard > Authentication > Users >
-- pilih superadmin > Reset/Update password.
-- =======================================================================
-- UPDATE auth.users
-- SET encrypted_password = crypt('superadmin123', gen_salt('bf')),
--     updated_at = NOW()
-- WHERE id = (SELECT id FROM public.users WHERE username = 'superadmin');

-- =======================================================================
-- 5) (OPSIONAL) Bersihkan file nota di Storage
-- -----------------------------------------------------------------------
-- Menghapus baris storage.objects TIDAK selalu menghapus file fisik di
-- backend storage. Cara teraman: Supabase Dashboard > Storage >
-- bucket "nota-supplier" > pilih semua > Delete.
-- Alternatif via SQL (baris metadata saja):
-- DELETE FROM storage.objects WHERE bucket_id = 'nota-supplier';

-- =======================================================================
-- 6) VERIFIKASI (jalankan setelah COMMIT)
-- -----------------------------------------------------------------------
-- SELECT count(*) AS products      FROM products;            -- harus 0
-- SELECT count(*) AS sales         FROM sales;               -- harus 0
-- SELECT count(*) AS purchases     FROM purchases;           -- harus 0
-- SELECT count(*) AS adjustments   FROM stock_adjustments;   -- harus 0
-- SELECT count(*) AS stock_logs    FROM stock_logs;          -- harus 0
-- SELECT count(*) AS expenses      FROM expenses;            -- harus 0
-- SELECT count(*) AS doc_counters  FROM document_counters;   -- harus 0
-- SELECT username, role, is_active FROM public.users;        -- hanya superadmin
-- SELECT email FROM auth.users;                              -- hanya 1 akun
