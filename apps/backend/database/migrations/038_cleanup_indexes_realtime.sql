-- Migration 038 — DB cleanup: hapus index duplikat + lengkapi publication realtime
--
-- (1) Migrasi 027 membuat ulang index yang SUDAH ada (nama beda) dari 002/003,
--     sehingga ada 6 index ganda → boros write & storage. Hapus yang duplikat
--     (sisakan versi asli dari 002/003).
-- (2) Pastikan SEMUA tabel yang di-subscribe frontend ada di publication
--     `supabase_realtime`, supaya update stok/transaksi/saldo benar-benar
--     realtime (mis. `expenses` agar ringkasan keuangan ikut update).

-- ---------- (1) Hapus index duplikat dari migrasi 027 ----------
DROP INDEX IF EXISTS idx_sales_created_at;          -- duplikat idx_sales_created (002)
DROP INDEX IF EXISTS idx_purchases_created_at;      -- duplikat idx_purchases_created (002)
DROP INDEX IF EXISTS idx_sale_items_sale_id;        -- duplikat idx_sale_items_sale (002)
DROP INDEX IF EXISTS idx_purchase_items_purchase_id; -- duplikat idx_purchase_items_purchase (002)
DROP INDEX IF EXISTS idx_stock_logs_created_at;     -- duplikat idx_stock_logs_created (003)
DROP INDEX IF EXISTS idx_stock_logs_user_id;        -- duplikat idx_stock_logs_user (003)
-- (idx_stock_adj_type_status dari 027 DIPERTAHANKAN — bukan duplikat)

-- ---------- (2) Lengkapi publication realtime (idempotent) ----------
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE products;               EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE sales;                  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE sale_items;             EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE purchases;              EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE purchase_items;         EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE stock_logs;             EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE expenses;               EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE users;                  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE stock_adjustments;      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE stock_adjustment_items; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
