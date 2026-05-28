-- Migration 003 — Stock Logs (Audit Trail Rule-Based System)
-- Satu tabel sebagai jejak audit untuk SEMUA rule (R1..R5).
-- Setiap baris menyimpan: efek pada stok (delta_qty, sebelum/sesudah),
-- rule yang aktif (rule_triggered), aksi yang diambil (ACCEPTED /
-- REJECTED / TRIGGERED), sumber (sales / purchase / manual), serta
-- konteks bebas dalam JSONB.
DO $$ BEGIN
  CREATE TYPE stock_log_source AS ENUM ('sales', 'purchase', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE stock_log_action AS ENUM ('ACCEPTED', 'REJECTED', 'TRIGGERED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS stock_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID REFERENCES products(id) ON DELETE SET NULL,
  user_id         UUID REFERENCES users(id),
  delta_qty       INTEGER NOT NULL DEFAULT 0,
  stok_sebelum    INTEGER,
  stok_sesudah    INTEGER,
  source_type     stock_log_source NOT NULL,
  rule_triggered  TEXT,                  -- 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | NULL
  rule_action     stock_log_action NOT NULL,
  reason_detail   TEXT,
  context_payload JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_logs_created  ON stock_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_logs_product  ON stock_logs (product_id);
CREATE INDEX IF NOT EXISTS idx_stock_logs_user     ON stock_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_stock_logs_rule     ON stock_logs (rule_triggered);
CREATE INDEX IF NOT EXISTS idx_stock_logs_action   ON stock_logs (rule_action);
CREATE INDEX IF NOT EXISTS idx_stock_logs_source   ON stock_logs (source_type);
