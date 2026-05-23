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
-- =================================================================
-- Migration 003 — Stock Logs (Audit Trail Rule-Based System)
-- =================================================================
-- Satu tabel sebagai jejak audit untuk SEMUA rule (R1..R5).
-- Setiap baris menyimpan: efek pada stok (delta_qty, sebelum/sesudah),
-- rule yang aktif (rule_triggered), aksi yang diambil (ACCEPTED /
-- REJECTED / TRIGGERED), sumber (sales / purchase / manual), serta
-- konteks bebas dalam JSONB.
-- =================================================================

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
-- =================================================================
-- Migration 005 — Row Level Security
-- =================================================================
-- Backend pakai SERVICE ROLE key (bypass RLS) — policy berikut hanya
-- bertindak sebagai pengaman tambahan jika kelak ada akses langsung
-- dari frontend dengan JWT user.
-- =================================================================

-- Helper: ambil role current user dari tabel users (kalau JWT terpasang)
CREATE OR REPLACE FUNCTION fn_current_role()
RETURNS TEXT AS $$
  SELECT role::text FROM users WHERE id = auth.uid();
$$ LANGUAGE sql STABLE;

-- ---------- USERS ----------
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_self_select ON users;
CREATE POLICY users_self_select ON users
  FOR SELECT USING (id = auth.uid() OR fn_current_role() = 'admin');

DROP POLICY IF EXISTS users_admin_modify ON users;
CREATE POLICY users_admin_modify ON users
  FOR ALL USING (fn_current_role() = 'admin')
  WITH CHECK (fn_current_role() = 'admin');

-- ---------- PRODUCTS ----------
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS products_authed_select ON products;
CREATE POLICY products_authed_select ON products
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS products_authed_modify ON products;
CREATE POLICY products_authed_modify ON products
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ---------- SALES + ITEMS ----------
ALTER TABLE sales       ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sales_authed_all ON sales;
CREATE POLICY sales_authed_all ON sales
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS sale_items_authed_all ON sale_items;
CREATE POLICY sale_items_authed_all ON sale_items
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ---------- PURCHASES + ITEMS ----------
ALTER TABLE purchases       ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS purchases_authed_all ON purchases;
CREATE POLICY purchases_authed_all ON purchases
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS purchase_items_authed_all ON purchase_items;
CREATE POLICY purchase_items_authed_all ON purchase_items
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ---------- STOCK LOGS ----------
ALTER TABLE stock_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stock_logs_authed_select ON stock_logs;
CREATE POLICY stock_logs_authed_select ON stock_logs
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS stock_logs_authed_insert ON stock_logs;
CREATE POLICY stock_logs_authed_insert ON stock_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
-- =================================================================
-- Migration 006 — Triggers R3 (Pembaruan Stok Terpusat) & R4 (Konsistensi)
-- =================================================================
-- R3: BEFORE UPDATE pada products — kolom `stok` HANYA boleh berubah
--     bila session memasang flag app.allow_stok_update='true'.
--     Flag itu di-SET LOCAL oleh fn_create_sale / fn_commit_purchase
--     sehingga update stok dari jalur lain (PATCH /api/products,
--     query manual di SQL editor, dll) langsung ditolak.
--
-- R4: AFTER INSERT pada sale_items & purchase_items — secara atomik
--     menambah/mengurangi products.stok DAN menulis stock_logs entry
--     ACCEPTED. Inilah satu-satunya jalur "resmi" untuk perubahan stok.
--
-- SQLSTATE custom:
--   '45R01' = R1 violation (dilempar fn_create_sale)
--   '45R03' = R3 violation (manual stok update tanpa flag)
-- =================================================================

-- ---------- R3: BLOCK manual update kolom stok ----------
CREATE OR REPLACE FUNCTION fn_products_block_manual_stok_update()
RETURNS TRIGGER AS $$
DECLARE
  v_allow TEXT;
BEGIN
  IF NEW.stok IS DISTINCT FROM OLD.stok THEN
    BEGIN
      v_allow := current_setting('app.allow_stok_update', true);
    EXCEPTION WHEN OTHERS THEN
      v_allow := NULL;
    END;

    IF COALESCE(v_allow, 'false') <> 'true' THEN
      RAISE EXCEPTION
        'R3: Stok tidak boleh diubah manual. Stok hanya berubah lewat penjualan / stok masuk.'
        USING ERRCODE = '45R03';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_products_block_manual_stok ON products;
CREATE TRIGGER trg_products_block_manual_stok
BEFORE UPDATE OF stok ON products
FOR EACH ROW EXECUTE FUNCTION fn_products_block_manual_stok_update();

-- ---------- R4 (sales): kurangi stok + tulis stock_logs ACCEPTED ----------
CREATE OR REPLACE FUNCTION fn_sale_items_apply()
RETURNS TRIGGER AS $$
DECLARE
  v_before INTEGER;
  v_after  INTEGER;
  v_user   UUID;
BEGIN
  SELECT stok INTO v_before FROM products WHERE id = NEW.product_id FOR UPDATE;

  IF v_before IS NULL THEN
    RAISE EXCEPTION 'Produk % tidak ditemukan saat memproses sale_items', NEW.product_id;
  END IF;

  IF v_before < NEW.qty THEN
    RAISE EXCEPTION 'R1: Stok tidak mencukupi untuk produk % (tersedia %, diminta %)',
      NEW.product_id, v_before, NEW.qty
      USING ERRCODE = '45R01';
  END IF;

  v_after := v_before - NEW.qty;

  -- Update stok dengan flag (lolos R3)
  PERFORM set_config('app.allow_stok_update', 'true', true);
  UPDATE products SET stok = v_after WHERE id = NEW.product_id;
  PERFORM set_config('app.allow_stok_update', 'false', true);

  -- Tentukan user dari header sales
  SELECT user_id INTO v_user FROM sales WHERE id = NEW.sale_id;

  INSERT INTO stock_logs (
    product_id, user_id, delta_qty, stok_sebelum, stok_sesudah,
    source_type, rule_triggered, rule_action, reason_detail, context_payload
  ) VALUES (
    NEW.product_id, v_user, -NEW.qty, v_before, v_after,
    'sales', 'R4', 'ACCEPTED',
    'Stok berkurang otomatis oleh trigger R4 (sale_items insert)',
    jsonb_build_object('sale_id', NEW.sale_id, 'sale_item_id', NEW.id, 'qty', NEW.qty)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sale_items_apply ON sale_items;
CREATE TRIGGER trg_sale_items_apply
AFTER INSERT ON sale_items
FOR EACH ROW EXECUTE FUNCTION fn_sale_items_apply();

-- ---------- R4 (purchases): tambah stok + tulis stock_logs ACCEPTED ----------
CREATE OR REPLACE FUNCTION fn_purchase_items_apply()
RETURNS TRIGGER AS $$
DECLARE
  v_before INTEGER;
  v_after  INTEGER;
  v_user   UUID;
  v_status purchase_validation;
BEGIN
  -- Hanya proses jika header purchases status_validasi='tervalidasi'
  SELECT user_id, status_validasi INTO v_user, v_status
    FROM purchases WHERE id = NEW.purchase_id;

  IF v_status IS DISTINCT FROM 'tervalidasi' THEN
    -- Stok tidak ditambah; biarkan baris item tetap masuk sebagai draft.
    RETURN NEW;
  END IF;

  SELECT stok INTO v_before FROM products WHERE id = NEW.product_id FOR UPDATE;
  IF v_before IS NULL THEN
    RAISE EXCEPTION 'Produk % tidak ditemukan saat memproses purchase_items', NEW.product_id;
  END IF;

  v_after := v_before + NEW.qty;

  PERFORM set_config('app.allow_stok_update', 'true', true);
  UPDATE products SET stok = v_after WHERE id = NEW.product_id;
  PERFORM set_config('app.allow_stok_update', 'false', true);

  INSERT INTO stock_logs (
    product_id, user_id, delta_qty, stok_sebelum, stok_sesudah,
    source_type, rule_triggered, rule_action, reason_detail, context_payload
  ) VALUES (
    NEW.product_id, v_user, NEW.qty, v_before, v_after,
    'purchase', 'R4', 'ACCEPTED',
    'Stok bertambah otomatis oleh trigger R4 (purchase_items insert)',
    jsonb_build_object(
      'purchase_id',     NEW.purchase_id,
      'purchase_item_id', NEW.id,
      'qty',              NEW.qty,
      'harga_beli',       NEW.harga_beli,
      'diskon_persen',    NEW.diskon_persen,
      'source',           NEW.source
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_purchase_items_apply ON purchase_items;
CREATE TRIGGER trg_purchase_items_apply
AFTER INSERT ON purchase_items
FOR EACH ROW EXECUTE FUNCTION fn_purchase_items_apply();
-- =================================================================
-- Migration 007 — View R5 (Rekomendasi Restock) — versi awal
-- =================================================================
-- View ini dipakai endpoint GET /api/restock. Disempurnakan di
-- migrasi 011 dengan kolom avg_sales_30d & estimasi_hari_habis.
--
-- Tingkat urgensi:
--   HABIS    = stok = 0
--   KRITIS   = stok > 0 AND stok <= ceil(min_stock * 0.5)
--   MENIPIS  = stok > kritis AND stok <= min_stock
-- =================================================================

DROP VIEW IF EXISTS v_restock_recommendation CASCADE;

CREATE OR REPLACE VIEW v_restock_recommendation AS
SELECT
  p.id,
  p.kode_barang,
  p.nama_barang,
  p.merk,
  p.stok,
  p.min_stock,
  GREATEST(p.min_stock - p.stok, 0)::INTEGER AS kekurangan,
  CASE
    WHEN p.stok = 0 THEN 'HABIS'
    WHEN p.stok <= CEIL(p.min_stock::numeric * 0.5) THEN 'KRITIS'
    ELSE 'MENIPIS'
  END AS tingkat_urgensi,
  p.harga_beli,
  p.harga_jual,
  p.status::text AS status
FROM products p
WHERE p.status = 'aktif' AND p.stok <= p.min_stock
ORDER BY
  CASE
    WHEN p.stok = 0 THEN 0
    WHEN p.stok <= CEIL(p.min_stock::numeric * 0.5) THEN 1
    ELSE 2
  END,
  (p.min_stock - p.stok) DESC;
-- =================================================================
-- Migration 008 — RPC fn_create_sale (transaksi atomik penjualan)
-- =================================================================
-- Dipanggil dari salesRepository.createSaleViaRpc().
-- Param:
--   p_user_id        UUID
--   p_kode_transaksi TEXT
--   p_items          JSONB = [{product_id, qty, harga_satuan}, ...]
-- Return: JSONB { sale_id: UUID, total_harga: NUMERIC }
--
-- Alur:
--   - INSERT header sales (total=0, akan di-update di akhir)
--   - Loop items → INSERT sale_items. Trigger R4 mengurangi stok &
--     menulis stock_logs ACCEPTED. Trigger juga melempar SQLSTATE
--     '45R01' bila stok kurang → seluruh function rollback otomatis.
--   - Update total_harga pada header sales.
-- =================================================================

CREATE OR REPLACE FUNCTION fn_create_sale(
  p_user_id        UUID,
  p_kode_transaksi TEXT,
  p_items          JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sale_id    UUID;
  v_total      NUMERIC(14,2) := 0;
  v_item       JSONB;
  v_product_id UUID;
  v_qty        INTEGER;
  v_harga      NUMERIC(14,2);
  v_subtotal   NUMERIC(14,2);
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Items kosong: minimal 1 item';
  END IF;

  INSERT INTO sales (kode_transaksi, user_id, total_harga)
  VALUES (p_kode_transaksi, p_user_id, 0)
  RETURNING id INTO v_sale_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_qty        := (v_item->>'qty')::INTEGER;
    v_harga      := (v_item->>'harga_satuan')::NUMERIC;

    IF v_product_id IS NULL OR v_qty IS NULL OR v_qty <= 0 OR v_harga IS NULL OR v_harga < 0 THEN
      RAISE EXCEPTION 'Item tidak valid: %', v_item;
    END IF;

    v_subtotal := v_qty * v_harga;

    INSERT INTO sale_items (sale_id, product_id, qty, harga_satuan, subtotal)
    VALUES (v_sale_id, v_product_id, v_qty, v_harga, v_subtotal);

    v_total := v_total + v_subtotal;
  END LOOP;

  UPDATE sales SET total_harga = v_total WHERE id = v_sale_id;

  RETURN jsonb_build_object('sale_id', v_sale_id, 'total_harga', v_total);
END;
$$;

GRANT EXECUTE ON FUNCTION fn_create_sale(UUID, TEXT, JSONB) TO authenticated, service_role;
-- =================================================================
-- Migration 009 — RPC fn_commit_purchase (commit stok masuk atomik)
-- =================================================================
-- Dipanggil dari purchaseRepository.commitPurchaseViaRpc().
-- Param:
--   p_user_id           UUID
--   p_no_nota_supplier  TEXT (nullable)
--   p_file_nota_url     TEXT (nullable — path di storage bucket)
--   p_items             JSONB = [
--      {action:'restock', product_id, qty, harga_beli, diskon_persen, source} |
--      {action:'new',     kode_barang, nama_barang, qty, harga_beli,
--       diskon_persen, source}
--   ]
-- Return: JSONB { purchase_id, total, products_created }
--
-- Catatan:
--   - Header purchases di-INSERT dengan status_validasi='tervalidasi'
--     sehingga trigger R4 (purchase_items) langsung menambah stok.
--   - Untuk action='new' kita INSERT produk dulu dengan stok=0,
--     harga_beli/harga_jual dari payload (harga_jual = harga_beli * 1.3
--     sebagai default — admin bisa edit nanti via master barang).
-- =================================================================

CREATE OR REPLACE FUNCTION fn_commit_purchase(
  p_user_id           UUID,
  p_no_nota_supplier  TEXT,
  p_file_nota_url     TEXT,
  p_items             JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_purchase_id      UUID;
  v_total            NUMERIC(14,2) := 0;
  v_products_created INTEGER := 0;
  v_item             JSONB;
  v_action           TEXT;
  v_product_id       UUID;
  v_kode             TEXT;
  v_nama             TEXT;
  v_qty              INTEGER;
  v_harga_beli       NUMERIC(14,2);
  v_diskon           NUMERIC(5,2);
  v_source           purchase_item_source;
  v_subtotal         NUMERIC(14,2);
  v_existing_pid     UUID;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Items kosong: minimal 1 item';
  END IF;

  INSERT INTO purchases (no_nota_supplier, user_id, total, status_validasi, file_nota_url)
  VALUES (p_no_nota_supplier, p_user_id, 0, 'tervalidasi', p_file_nota_url)
  RETURNING id INTO v_purchase_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_action      := COALESCE(v_item->>'action', 'restock');
    v_qty         := (v_item->>'qty')::INTEGER;
    v_harga_beli  := (v_item->>'harga_beli')::NUMERIC;
    v_diskon      := COALESCE((v_item->>'diskon_persen')::NUMERIC, 0);
    v_source      := COALESCE((v_item->>'source')::purchase_item_source, 'manual'::purchase_item_source);

    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'qty tidak valid pada item %', v_item;
    END IF;
    IF v_harga_beli IS NULL OR v_harga_beli < 0 THEN
      RAISE EXCEPTION 'harga_beli tidak valid pada item %', v_item;
    END IF;

    IF v_action = 'new' THEN
      v_kode := TRIM(COALESCE(v_item->>'kode_barang', ''));
      v_nama := TRIM(COALESCE(v_item->>'nama_barang', ''));
      IF v_kode = '' OR v_nama = '' THEN
        RAISE EXCEPTION 'action=new wajib kode_barang & nama_barang';
      END IF;

      -- Kalau kode_barang sudah ada → treat sebagai restock saja
      SELECT id INTO v_existing_pid FROM products WHERE kode_barang = v_kode;
      IF v_existing_pid IS NOT NULL THEN
        v_product_id := v_existing_pid;
      ELSE
        INSERT INTO products (kode_barang, nama_barang, harga_beli, harga_jual, stok, min_stock, status)
        VALUES (v_kode, v_nama, v_harga_beli, ROUND(v_harga_beli * 1.3, 0), 0, 0, 'aktif')
        RETURNING id INTO v_product_id;
        v_products_created := v_products_created + 1;
      END IF;
    ELSE
      v_product_id := (v_item->>'product_id')::UUID;
      IF v_product_id IS NULL THEN
        RAISE EXCEPTION 'action=restock wajib product_id';
      END IF;
    END IF;

    INSERT INTO purchase_items (purchase_id, product_id, qty, harga_beli, diskon_persen, source)
    VALUES (v_purchase_id, v_product_id, v_qty, v_harga_beli, v_diskon, v_source);

    v_subtotal := v_qty * v_harga_beli * (1 - v_diskon / 100.0);
    v_total := v_total + v_subtotal;
  END LOOP;

  UPDATE purchases SET total = v_total WHERE id = v_purchase_id;

  RETURN jsonb_build_object(
    'purchase_id', v_purchase_id,
    'total', v_total,
    'products_created', v_products_created
  );
END;
$$;

GRANT EXECUTE ON FUNCTION fn_commit_purchase(UUID, TEXT, TEXT, JSONB) TO authenticated, service_role;
-- =================================================================
-- Migration 010 — purchase_drafts (Cross-device Draft Resume)
-- =================================================================
-- Untuk fitur "scan dari HP, edit di laptop": draft OCR yang belum
-- di-commit disimpan di tabel ini. User bisa list & resume dari device
-- manapun selama login dengan akun yang sama.
--
-- Catatan keamanan: payload disimpan sebagai JSONB. Tidak boleh berisi
-- data sensitif lain selain hasil parsing OCR + state validasi user.
-- =================================================================

CREATE TABLE IF NOT EXISTS purchase_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  no_nota_supplier TEXT,
  file_nota_url TEXT NOT NULL,
  nota_type TEXT,
  raw_text TEXT,
  preprocessing JSONB,
  quality JSONB,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft' | 'manual'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_drafts_user_created
  ON purchase_drafts (user_id, created_at DESC);

-- Trigger: setiap UPDATE → updated_at = NOW()
CREATE OR REPLACE FUNCTION fn_purchase_drafts_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_purchase_drafts_touch ON purchase_drafts;
CREATE TRIGGER trg_purchase_drafts_touch
BEFORE UPDATE ON purchase_drafts
FOR EACH ROW EXECUTE FUNCTION fn_purchase_drafts_touch_updated_at();

-- RLS — user hanya bisa lihat draft milik sendiri
ALTER TABLE purchase_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS purchase_drafts_owner_select ON purchase_drafts;
CREATE POLICY purchase_drafts_owner_select
  ON purchase_drafts FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS purchase_drafts_owner_modify ON purchase_drafts;
CREATE POLICY purchase_drafts_owner_modify
  ON purchase_drafts FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
-- =================================================================
-- Migration 011 — Extend view v_restock_recommendation
-- =================================================================
-- Tambah kolom rata-rata penjualan 30 hari & estimasi habis stok.
-- Nilai dihitung dari sale_items × sales.created_at (>= NOW()-30d).
--
-- - avg_sales_30d        = total qty terjual / 30 (qty/hari, NUMERIC)
-- - total_sold_30d       = total qty terjual 30 hari terakhir
-- - n_transactions_30d   = jumlah transaksi unik yang menyentuh produk
-- - estimasi_hari_habis  = stok / avg_sales_30d (NULL bila avg = 0)
-- =================================================================

DROP VIEW IF EXISTS v_restock_recommendation CASCADE;

CREATE OR REPLACE VIEW v_restock_recommendation AS
WITH stat_30d AS (
  SELECT
    si.product_id,
    COALESCE(SUM(si.qty), 0)::INTEGER         AS total_sold_30d,
    COUNT(DISTINCT si.sale_id)::INTEGER       AS n_transactions_30d
  FROM sale_items si
  JOIN sales s ON s.id = si.sale_id
  WHERE s.created_at >= NOW() - INTERVAL '30 days'
  GROUP BY si.product_id
)
SELECT
  p.id,
  p.kode_barang,
  p.nama_barang,
  p.merk,
  p.stok,
  p.min_stock,
  GREATEST(p.min_stock - p.stok, 0)::INTEGER AS kekurangan,
  CASE
    WHEN p.stok = 0 THEN 'HABIS'
    WHEN p.stok <= CEIL(p.min_stock::numeric * 0.5) THEN 'KRITIS'
    ELSE 'MENIPIS'
  END AS tingkat_urgensi,
  p.harga_beli,
  p.harga_jual,
  p.status::text                AS status,
  ROUND(COALESCE(s30.total_sold_30d, 0)::NUMERIC / 30.0, 2) AS avg_sales_30d,
  COALESCE(s30.total_sold_30d, 0)            AS total_sold_30d,
  COALESCE(s30.n_transactions_30d, 0)        AS n_transactions_30d,
  CASE
    WHEN COALESCE(s30.total_sold_30d, 0) = 0 THEN NULL
    ELSE ROUND(p.stok::NUMERIC / (s30.total_sold_30d::NUMERIC / 30.0), 1)
  END                                        AS estimasi_hari_habis
FROM products p
LEFT JOIN stat_30d s30 ON s30.product_id = p.id
WHERE p.status = 'aktif' AND p.stok <= p.min_stock
ORDER BY
  CASE
    WHEN p.stok = 0 THEN 0
    WHEN p.stok <= CEIL(p.min_stock::numeric * 0.5) THEN 1
    ELSE 2
  END,
  (p.min_stock - p.stok) DESC;
-- =================================================================
-- Migration 012 — users.is_active (soft-deactivate akun)
-- =================================================================
-- Dipakai authMiddleware untuk menolak request dari user yang sudah
-- dinonaktifkan admin, meski JWT-nya belum kedaluwarsa.
-- =================================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_users_is_active ON users (is_active);
-- =================================================================
-- Migration 013 — Expenses (Pengeluaran Operasional) & Saldo
-- =================================================================
-- Tabel pengeluaran operasional yang DI LUAR pembelian supplier
-- (gaji karyawan, listrik, air, sewa, dsb). Pembelian supplier
-- otomatis ikut potong saldo karena diambil dari tabel purchases
-- yang status_validasi='tervalidasi' (lihat view v_finance_summary).
--
-- Formula saldo bersih:
--   saldo_bersih = omset_kotor (sales)
--                  - total_pembelian_supplier (purchases tervalidasi)
--                  - total_pengeluaran_operasional (expenses)
-- =================================================================

DO $$ BEGIN
  CREATE TYPE expense_kind AS ENUM ('gaji', 'listrik', 'air', 'sewa', 'lainnya');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS expenses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jenis       expense_kind NOT NULL DEFAULT 'lainnya',
  deskripsi   TEXT NOT NULL,
  nominal     NUMERIC(14,2) NOT NULL CHECK (nominal > 0),
  tanggal     DATE NOT NULL DEFAULT CURRENT_DATE,
  user_id     UUID NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_tanggal ON expenses (tanggal DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_jenis   ON expenses (jenis);
CREATE INDEX IF NOT EXISTS idx_expenses_user    ON expenses (user_id);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS expenses_authed_select ON expenses;
CREATE POLICY expenses_authed_select ON expenses
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS expenses_authed_modify ON expenses;
CREATE POLICY expenses_authed_modify ON expenses
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ---------- View ringkasan keuangan ----------
-- Param-less view; filter tanggal dilakukan di backend pakai aggregation.
-- Tetap disediakan view all-time untuk kebutuhan summary cepat.
CREATE OR REPLACE VIEW v_finance_summary_alltime AS
SELECT
  COALESCE((SELECT SUM(total_harga) FROM sales), 0)                                              AS omset_kotor,
  COALESCE((SELECT SUM(total) FROM purchases WHERE status_validasi = 'tervalidasi'), 0)          AS total_pembelian,
  COALESCE((SELECT SUM(nominal) FROM expenses), 0)                                               AS total_pengeluaran,
  COALESCE((SELECT SUM(total_harga) FROM sales), 0)
    - COALESCE((SELECT SUM(total) FROM purchases WHERE status_validasi = 'tervalidasi'), 0)
    - COALESCE((SELECT SUM(nominal) FROM expenses), 0)                                           AS saldo_bersih;
-- =================================================================
-- Migration 014 — sale_items.diskon_persen (Diskon per item di POS)
-- =================================================================
-- Kasir bisa memberi diskon manual per baris di keranjang. Subtotal
-- final = qty * harga_satuan * (1 - diskon_persen/100). Default 0.
-- =================================================================

ALTER TABLE sale_items
  ADD COLUMN IF NOT EXISTS diskon_persen NUMERIC(5,2) NOT NULL DEFAULT 0
  CHECK (diskon_persen BETWEEN 0 AND 100);

-- Update fn_create_sale supaya menerima dan menerapkan diskon per item
CREATE OR REPLACE FUNCTION fn_create_sale(
  p_user_id        UUID,
  p_kode_transaksi TEXT,
  p_items          JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sale_id    UUID;
  v_total      NUMERIC(14,2) := 0;
  v_item       JSONB;
  v_product_id UUID;
  v_qty        INTEGER;
  v_harga      NUMERIC(14,2);
  v_diskon     NUMERIC(5,2);
  v_subtotal   NUMERIC(14,2);
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Items kosong: minimal 1 item';
  END IF;

  INSERT INTO sales (kode_transaksi, user_id, total_harga)
  VALUES (p_kode_transaksi, p_user_id, 0)
  RETURNING id INTO v_sale_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_qty        := (v_item->>'qty')::INTEGER;
    v_harga      := (v_item->>'harga_satuan')::NUMERIC;
    v_diskon     := COALESCE((v_item->>'diskon_persen')::NUMERIC, 0);

    IF v_product_id IS NULL OR v_qty IS NULL OR v_qty <= 0
       OR v_harga IS NULL OR v_harga < 0 THEN
      RAISE EXCEPTION 'Item tidak valid: %', v_item;
    END IF;
    IF v_diskon < 0 OR v_diskon > 100 THEN
      RAISE EXCEPTION 'diskon_persen harus 0-100 (item: %)', v_item;
    END IF;

    v_subtotal := ROUND(v_qty * v_harga * (1 - v_diskon / 100.0), 2);

    INSERT INTO sale_items (sale_id, product_id, qty, harga_satuan, diskon_persen, subtotal)
    VALUES (v_sale_id, v_product_id, v_qty, v_harga, v_diskon, v_subtotal);

    v_total := v_total + v_subtotal;
  END LOOP;

  UPDATE sales SET total_harga = v_total WHERE id = v_sale_id;

  RETURN jsonb_build_object('sale_id', v_sale_id, 'total_harga', v_total);
END;
$$;
-- =================================================================
-- Migration 015 — Rename enum expense_kind
-- =================================================================
-- Permintaan user:
--   'sewa'    -> 'supplier'  (pembelian dari supplier yang tidak via OCR)
--   'lainnya' -> 'custom'    (pengeluaran custom dengan deskripsi bebas)
--
-- PostgreSQL 10+ mendukung ALTER TYPE … RENAME VALUE — aman dijalankan
-- walau ada data eksisting (label berubah, ID enum di-preserve).
-- =================================================================

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
