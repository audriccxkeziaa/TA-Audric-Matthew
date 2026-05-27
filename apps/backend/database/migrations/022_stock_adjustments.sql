-- =================================================================
-- Migration 022 — Stock Adjustments (Retur & Penyesuaian Stok)
-- =================================================================
-- Menangani 3 skenario:
--   1. return_supplier   — Retur ke supplier (stok -)
--   2. sales_return      — Retur pelanggan:
--        kondisi='bagus' → stok +
--        kondisi='rusak' → stok tetap (masuk kategori reject)
--   3. stock_adjustment  — Penyusutan / kerusakan di toko (stok -)
--
-- Prinsip Immutability: tidak ada data lama yang diubah/dihapus.
-- Setiap koreksi stok membuat baris INSERT baru.
-- =================================================================

-- Extend stock_log_source enum agar stock_logs bisa mencatat 'adjustment'.
-- PENTING: ALTER TYPE ADD VALUE tidak boleh di dalam transaction block.
ALTER TYPE stock_log_source ADD VALUE IF NOT EXISTS 'adjustment';

-- Tipe penyesuaian stok
DO $$ BEGIN
  CREATE TYPE adjustment_type AS ENUM ('return_supplier', 'sales_return', 'stock_adjustment');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- HEADER ----------
CREATE TABLE IF NOT EXISTS stock_adjustments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kode_adjustment       TEXT NOT NULL UNIQUE,
  type                  adjustment_type NOT NULL,
  user_id               UUID NOT NULL REFERENCES users(id),
  reference_sale_id     UUID REFERENCES sales(id),
  reference_purchase_id UUID REFERENCES purchases(id),
  alasan                TEXT NOT NULL,
  catatan               TEXT,
  total_qty             INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_adj_type    ON stock_adjustments (type);
CREATE INDEX IF NOT EXISTS idx_stock_adj_created ON stock_adjustments (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_adj_user    ON stock_adjustments (user_id);

-- ---------- ITEMS ----------
CREATE TABLE IF NOT EXISTS stock_adjustment_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adjustment_id   UUID NOT NULL REFERENCES stock_adjustments(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products(id),
  qty             INTEGER NOT NULL CHECK (qty > 0),
  kondisi         TEXT CHECK (kondisi IN ('bagus', 'rusak') OR kondisi IS NULL),
  harga_satuan    NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_adj_items_adj     ON stock_adjustment_items (adjustment_id);
CREATE INDEX IF NOT EXISTS idx_stock_adj_items_product ON stock_adjustment_items (product_id);

-- ---------- RPC: fn_create_stock_adjustment ----------
CREATE OR REPLACE FUNCTION fn_create_stock_adjustment(
  p_user_id               UUID,
  p_kode                  TEXT,
  p_type                  adjustment_type,
  p_reference_sale_id     UUID DEFAULT NULL,
  p_reference_purchase_id UUID DEFAULT NULL,
  p_alasan                TEXT DEFAULT '',
  p_catatan               TEXT DEFAULT NULL,
  p_items                 JSONB DEFAULT '[]'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_adj_id     UUID;
  v_total_qty  INTEGER := 0;
  v_item       JSONB;
  v_product_id UUID;
  v_qty        INTEGER;
  v_kondisi    TEXT;
  v_harga      NUMERIC(14,2);
  v_before     INTEGER;
  v_after      INTEGER;
  v_delta      INTEGER;
  v_reason     TEXT;
BEGIN
  -- Validasi dasar
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Items kosong: minimal 1 item';
  END IF;
  IF TRIM(COALESCE(p_alasan, '')) = '' THEN
    RAISE EXCEPTION 'Alasan wajib diisi';
  END IF;

  -- Buat header
  INSERT INTO stock_adjustments (
    kode_adjustment, type, user_id,
    reference_sale_id, reference_purchase_id,
    alasan, catatan
  ) VALUES (
    p_kode, p_type, p_user_id,
    p_reference_sale_id, p_reference_purchase_id,
    p_alasan, p_catatan
  ) RETURNING id INTO v_adj_id;

  -- Set flag agar R3 trigger mengizinkan update stok
  PERFORM set_config('app.allow_stok_update', 'true', true);

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_qty        := (v_item->>'qty')::INTEGER;
    v_kondisi    := v_item->>'kondisi';
    v_harga      := COALESCE((v_item->>'harga_satuan')::NUMERIC, 0);

    IF v_product_id IS NULL OR v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Item tidak valid: product_id dan qty wajib (qty > 0)';
    END IF;

    -- Lock row produk
    SELECT stok INTO v_before FROM products WHERE id = v_product_id FOR UPDATE;
    IF v_before IS NULL THEN
      RAISE EXCEPTION 'Produk % tidak ditemukan', v_product_id;
    END IF;

    -- Hitung delta berdasarkan tipe + kondisi
    IF p_type = 'return_supplier' THEN
      v_delta  := -v_qty;
      v_reason := 'Retur ke supplier';
    ELSIF p_type = 'sales_return' THEN
      IF v_kondisi = 'bagus' THEN
        v_delta  := v_qty;
        v_reason := 'Retur pelanggan (kondisi bagus, stok kembali)';
      ELSE
        v_delta  := 0;
        v_reason := 'Retur pelanggan (kondisi rusak, stok tidak kembali)';
      END IF;
    ELSIF p_type = 'stock_adjustment' THEN
      v_delta  := -v_qty;
      v_reason := 'Penyesuaian stok (penyusutan)';
    END IF;

    v_after := v_before + v_delta;

    -- Cegah stok negatif
    IF v_after < 0 THEN
      RAISE EXCEPTION 'Stok tidak mencukupi untuk produk % (tersedia %, diminta %)',
        v_product_id, v_before, v_qty
        USING ERRCODE = '45R01';
    END IF;

    -- Update stok jika ada perubahan
    IF v_delta <> 0 THEN
      UPDATE products SET stok = v_after WHERE id = v_product_id;
    END IF;

    -- Simpan item
    INSERT INTO stock_adjustment_items (adjustment_id, product_id, qty, kondisi, harga_satuan)
    VALUES (v_adj_id, v_product_id, v_qty, v_kondisi, v_harga);

    -- Tulis audit log ke stock_logs
    INSERT INTO stock_logs (
      product_id, user_id, delta_qty, stok_sebelum, stok_sesudah,
      source_type, rule_triggered, rule_action,
      reason_detail, context_payload
    ) VALUES (
      v_product_id, p_user_id, v_delta, v_before, v_after,
      'adjustment', 'R4', 'ACCEPTED',
      v_reason || ' — ' || p_alasan,
      jsonb_build_object(
        'adjustment_id',   v_adj_id,
        'adjustment_type', p_type::TEXT,
        'kondisi',         v_kondisi,
        'qty',             v_qty,
        'harga_satuan',    v_harga,
        'alasan',          p_alasan
      )
    );

    v_total_qty := v_total_qty + v_qty;
  END LOOP;

  -- Reset flag
  PERFORM set_config('app.allow_stok_update', 'false', true);

  UPDATE stock_adjustments SET total_qty = v_total_qty WHERE id = v_adj_id;

  RETURN jsonb_build_object(
    'adjustment_id', v_adj_id,
    'total_qty',     v_total_qty,
    'type',          p_type::TEXT
  );
END;
$$;

GRANT EXECUTE ON FUNCTION fn_create_stock_adjustment(UUID, TEXT, adjustment_type, UUID, UUID, TEXT, TEXT, JSONB)
  TO authenticated, service_role;
