-- _apply_all.sql — Jalankan semua migrasi sekaligus di Supabase SQL Editor
-- Cara pakai:
--   1) Buka Supabase Dashboard → project oepjabpiwaslolwxdood → SQL Editor
--   2) New query → copy seluruh isi file ini → paste → Run
--   3) Tunggu sampai semua statement selesai (idempotent: aman re-run)
--   4) Lanjut jalankan seed:  node apps/backend/database/seed.js
\i 001_initial_schema.sql
\i 002_sales_purchases.sql
\i 003_stock_logs.sql
\i 004_storage_bucket.sql
\i 005_rls_policies.sql
\i 006_triggers_R3_R4.sql
\i 007_view_R5.sql
\i 008_fn_create_sale.sql
\i 009_fn_commit_purchase.sql
\i 010_purchase_drafts.sql
\i 011_view_R5_avg_sales.sql
\i 012_users_is_active.sql
\i 013_expenses.sql
\i 014_sale_items_diskon.sql
\i 015_expenses_rename_jenis.sql
\i 016_purchase_diskon_nota.sql
\i 017_kode_normalized.sql
\i 018_users_updated_at.sql
\i 019_update_existing_users_email.sql
\i 020_enable_realtime.sql
\i 021_fn_commit_purchase_add_merk.sql
\i 022_stock_adjustments.sql

-- Catatan: \i hanya bekerja di psql, BUKAN di Supabase SQL Editor web.
-- Untuk Supabase SQL Editor, paste isi tiap file secara berurutan,
-- ATAU pakai file gabungan 'combined.sql' (jika sudah dibuat oleh script).
