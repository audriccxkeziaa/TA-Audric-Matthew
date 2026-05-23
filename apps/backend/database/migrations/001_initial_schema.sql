-- =================================================================
-- Migration 001 — Initial Schema (users + products)
-- =================================================================
-- Tabel inti yang dijadikan referensi oleh semua tabel lain. Mengacu
-- pada Supabase Auth: kolom users.id = auth.users.id (UUID).
-- =================================================================

-- Pastikan extension yang dipakai aktif
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------- ENUMS ----------
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'kasir');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE product_status AS ENUM ('aktif', 'nonaktif');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- USERS ----------
-- Profil aplikasi. PK = auth.users.id supaya 1:1 dengan Supabase Auth.
-- Email tidak disimpan di sini — sumber kebenaran ada di auth.users.
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    TEXT NOT NULL UNIQUE,
  role        user_role NOT NULL DEFAULT 'kasir',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);

-- ---------- PRODUCTS ----------
CREATE TABLE IF NOT EXISTS products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kode_barang TEXT NOT NULL UNIQUE,
  nama_barang TEXT NOT NULL,
  merk        TEXT,
  harga_beli  NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (harga_beli >= 0),
  harga_jual  NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (harga_jual >= 0),
  stok        INTEGER NOT NULL DEFAULT 0 CHECK (stok >= 0),
  min_stock   INTEGER NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
  status      product_status NOT NULL DEFAULT 'aktif',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_status ON products (status);
CREATE INDEX IF NOT EXISTS idx_products_nama   ON products (nama_barang);

-- Auto-touch updated_at pada UPDATE
CREATE OR REPLACE FUNCTION fn_products_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_products_touch ON products;
CREATE TRIGGER trg_products_touch
BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION fn_products_touch_updated_at();
