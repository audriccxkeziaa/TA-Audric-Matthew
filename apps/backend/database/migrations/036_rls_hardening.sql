-- Migration 036 — RLS Hardening (menutup S-C1: bypass RBAC via PostgREST langsung)
--
-- MASALAH (audit S-C1): migrasi 005 & 023 memasang policy
--   "FOR ALL USING (auth.uid() IS NOT NULL)" pada products, sales, sale_items,
--   purchases, purchase_items, stock_adjustments, stock_adjustment_items, plus
--   "FOR INSERT" bebas pada stock_logs. Karena frontend membawa anon key publik
--   dan JWT user, seorang kasir bisa memakai JWT-nya dari Postman untuk
--   INSERT/UPDATE/DELETE langsung ke Supabase PostgREST — mengubah harga,
--   menghapus transaksi orang lain, atau memalsukan audit trail — MELEWATI
--   RBAC di Express.
--
-- PRINSIP PERBAIKAN:
--   * Backend memakai SERVICE ROLE (bypass RLS) → SEMUA tulis tetap jalan via backend.
--   * Frontend hanya MEMBACA via anon (realtime postgres_changes + refresh token);
--     tidak pernah menulis langsung (sudah diverifikasi di kode).
--   => Ubah policy jadi READ-ONLY untuk authenticated (SELECT) agar realtime tetap
--      jalan, dan HAPUS kemampuan tulis langsung. Mutasi WAJIB lewat backend.
--
-- CATATAN (residual): authenticated masih bisa MEMBACA semua baris tabel ini.
--   Untuk toko satu cabang dengan 2 peran ini dapat diterima; pembatasan baca
--   per-baris tidak dilakukan agar Supabase Realtime (yang menghormati RLS SELECT)
--   tetap mengirim event ke klien. Pengetatan baca per-peran bisa menyusul bila perlu.

-- ---------- PRODUCTS ----------
-- Hapus policy tulis; sisakan SELECT (products_authed_select dari migrasi 005).
DROP POLICY IF EXISTS products_authed_modify ON products;

-- ---------- SALES + ITEMS ----------
DROP POLICY IF EXISTS sales_authed_all ON sales;
CREATE POLICY sales_authed_read ON sales
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS sale_items_authed_all ON sale_items;
CREATE POLICY sale_items_authed_read ON sale_items
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ---------- PURCHASES + ITEMS ----------
DROP POLICY IF EXISTS purchases_authed_all ON purchases;
CREATE POLICY purchases_authed_read ON purchases
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS purchase_items_authed_all ON purchase_items;
CREATE POLICY purchase_items_authed_read ON purchase_items
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ---------- STOCK LOGS ----------
-- Hapus INSERT langsung (cegah pemalsuan audit). Trigger backend (service role)
-- tetap bisa menulis karena bypass RLS. SELECT dibiarkan untuk baca/realtime.
DROP POLICY IF EXISTS stock_logs_authed_insert ON stock_logs;

-- ---------- STOCK ADJUSTMENTS + ITEMS ----------
DROP POLICY IF EXISTS stock_adj_authed_all ON stock_adjustments;
CREATE POLICY stock_adj_authed_read ON stock_adjustments
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS stock_adj_items_authed_all ON stock_adjustment_items;
CREATE POLICY stock_adj_items_authed_read ON stock_adjustment_items
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ===========================================================================
-- VERIFIKASI (jalankan manual setelah migrasi; opsional):
--   SELECT tablename, policyname, cmd FROM pg_policies
--   WHERE tablename IN ('products','sales','sale_items','purchases',
--     'purchase_items','stock_logs','stock_adjustments','stock_adjustment_items')
--   ORDER BY tablename, cmd;
-- Harapan: tidak ada lagi cmd='ALL' atau INSERT/UPDATE/DELETE untuk tabel ini
-- (selain SELECT). users tetap dengan policy self/admin dari migrasi 005.
-- ===========================================================================
