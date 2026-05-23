-- =================================================================
-- Migration 002 — Sales & Purchases (transaksi penjualan + stok masuk)
-- =================================================================
-- Header + items mengikuti pola klasik. Stok TIDAK pernah diupdate
-- manual lewat tabel ini; perubahan stok dilakukan oleh trigger R4
-- (lihat 006_triggers_R3_R4.sql) saat sale_items / purchase_items
-- di-INSERT, dan dijaga R3 supaya kolom stok tidak bisa di-UPDATE
-- dari jalur lain.
-- =================================================================

DO $$ BEGIN
  CREATE TYPE purchase_validation AS ENUM ('draft', 'tervalidasi');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE purchase_item_source AS ENUM ('ocr', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- SALES (penjualan) ----------
CREATE TABLE IF NOT EXISTS sales (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kode_transaksi  TEXT NOT NULL UNIQUE,
  user_id         UUID NOT NULL REFERENCES users(id),
  total_harga     NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (total_harga >= 0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_created  ON sales (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_user     ON sales (user_id);

CREATE TABLE IF NOT EXISTS sale_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id       UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id    UUID NOT NULL REFERENCES products(id),
  qty           INTEGER NOT NULL CHECK (qty > 0),
  harga_satuan  NUMERIC(14,2) NOT NULL CHECK (harga_satuan >= 0),
  subtotal      NUMERIC(14,2) NOT NULL CHECK (subtotal >= 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale     ON sale_items (sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product  ON sale_items (product_id);

-- ---------- PURCHASES (stok masuk) ----------
CREATE TABLE IF NOT EXISTS purchases (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  no_nota_supplier  TEXT,
  user_id           UUID NOT NULL REFERENCES users(id),
  total             NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  status_validasi   purchase_validation NOT NULL DEFAULT 'draft',
  file_nota_url     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchases_created  ON purchases (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_user     ON purchases (user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_status   ON purchases (status_validasi);

CREATE TABLE IF NOT EXISTS purchase_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id     UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products(id),
  qty             INTEGER NOT NULL CHECK (qty > 0),
  harga_beli      NUMERIC(14,2) NOT NULL CHECK (harga_beli >= 0),
  diskon_persen   NUMERIC(5,2)  NOT NULL DEFAULT 0 CHECK (diskon_persen BETWEEN 0 AND 100),
  source          purchase_item_source NOT NULL DEFAULT 'manual',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase  ON purchase_items (purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_product   ON purchase_items (product_id);
