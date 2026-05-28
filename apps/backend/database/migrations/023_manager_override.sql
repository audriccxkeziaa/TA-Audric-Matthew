-- Migration 023 — Manager Override (Otorisasi Ganda Retur Pelanggan)
-- Menambahkan workflow approval untuk sales_return:
--   Kasir buat retur → status 'pending' → Admin approve (PIN/remote).
-- Tipe lain (return_supplier, stock_adjustment) tetap langsung approved.
--
-- Fitur:
--   1. Kolom status, approved_by, approved_at di stock_adjustments
--   2. fn_create_stock_adjustment diperbarui (support pending)
--   3. fn_approve_stock_adjustment (eksekusi stok yang ditangguhkan)
--   4. fn_reject_stock_adjustment (tolak tanpa ubah stok)
--   5. RLS policy untuk realtime subscription
--   6. Realtime publication
-- 1. Tambah kolom approval
ALTER TABLE stock_adjustments
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved';
ALTER TABLE stock_adjustments
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id);
ALTER TABLE stock_adjustments
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

DO $$ BEGIN
  ALTER TABLE stock_adjustments
    ADD CONSTRAINT chk_adj_status CHECK (status IN ('pending', 'approved', 'rejected'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_stock_adj_pending
  ON stock_adjustments(created_at DESC) WHERE status = 'pending';

-- 2. RLS untuk stock_adjustments & items (agar realtime bisa subscribe)
ALTER TABLE stock_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_adjustment_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stock_adj_authed_all ON stock_adjustments;
CREATE POLICY stock_adj_authed_all ON stock_adjustments
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS stock_adj_items_authed_all ON stock_adjustment_items;
CREATE POLICY stock_adj_items_authed_all ON stock_adjustment_items
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- 3. Tambah ke realtime publication
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE stock_adjustments;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE stock_adjustment_items;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. DROP fungsi lama (8 parameter) lalu CREATE versi baru (9 parameter + p_status)
DROP FUNCTION IF EXISTS fn_create_stock_adjustment(UUID, TEXT, adjustment_type, UUID, UUID, TEXT, TEXT, JSONB);

CREATE OR REPLACE FUNCTION fn_create_stock_adjustment(
  p_user_id               UUID,
  p_kode                  TEXT,
  p_type                  adjustment_type,
  p_reference_sale_id     UUID DEFAULT NULL,
  p_reference_purchase_id UUID DEFAULT NULL,
  p_alasan                TEXT DEFAULT '',
  p_catatan               TEXT DEFAULT NULL,
  p_items                 JSONB DEFAULT '[]',
  p_status                TEXT DEFAULT 'approved'
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
  v_is_pending BOOLEAN;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Items kosong: minimal 1 item';
  END IF;
  IF TRIM(COALESCE(p_alasan, '')) = '' THEN
    RAISE EXCEPTION 'Alasan wajib diisi';
  END IF;
  IF p_status NOT IN ('pending', 'approved') THEN
    RAISE EXCEPTION 'Status awal hanya boleh pending atau approved';
  END IF;

  v_is_pending := (p_status = 'pending');

  INSERT INTO stock_adjustments (
    kode_adjustment, type, user_id,
    reference_sale_id, reference_purchase_id,
    alasan, catatan, status,
    approved_by, approved_at
  ) VALUES (
    p_kode, p_type, p_user_id,
    p_reference_sale_id, p_reference_purchase_id,
    p_alasan, p_catatan, p_status,
    CASE WHEN NOT v_is_pending THEN p_user_id ELSE NULL END,
    CASE WHEN NOT v_is_pending THEN NOW() ELSE NULL END
  ) RETURNING id INTO v_adj_id;

  IF NOT v_is_pending THEN
    PERFORM set_config('app.allow_stok_update', 'true', true);
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_qty        := (v_item->>'qty')::INTEGER;
    v_kondisi    := v_item->>'kondisi';
    v_harga      := COALESCE((v_item->>'harga_satuan')::NUMERIC, 0);

    IF v_product_id IS NULL OR v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Item tidak valid: product_id dan qty wajib (qty > 0)';
    END IF;

    SELECT stok INTO v_before FROM products WHERE id = v_product_id FOR UPDATE;
    IF v_before IS NULL THEN
      RAISE EXCEPTION 'Produk % tidak ditemukan', v_product_id;
    END IF;

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

    IF NOT v_is_pending THEN
      v_after := v_before + v_delta;

      IF v_after < 0 THEN
        RAISE EXCEPTION 'Stok tidak mencukupi untuk produk % (tersedia %, diminta %)',
          v_product_id, v_before, v_qty
          USING ERRCODE = '45R01';
      END IF;

      IF v_delta <> 0 THEN
        UPDATE products SET stok = v_after WHERE id = v_product_id;
      END IF;

      INSERT INTO stock_logs (
        product_id, user_id, delta_qty, stok_sebelum, stok_sesudah,
        source_type, rule_triggered, rule_action,
        reason_detail, context_payload
      ) VALUES (
        v_product_id, p_user_id, v_delta, v_before,
        CASE WHEN NOT v_is_pending THEN v_after ELSE v_before END,
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
    END IF;

    INSERT INTO stock_adjustment_items (adjustment_id, product_id, qty, kondisi, harga_satuan)
    VALUES (v_adj_id, v_product_id, v_qty, v_kondisi, v_harga);

    v_total_qty := v_total_qty + v_qty;
  END LOOP;

  IF NOT v_is_pending THEN
    PERFORM set_config('app.allow_stok_update', 'false', true);
  END IF;

  UPDATE stock_adjustments SET total_qty = v_total_qty WHERE id = v_adj_id;

  RETURN jsonb_build_object(
    'adjustment_id', v_adj_id,
    'total_qty',     v_total_qty,
    'type',          p_type::TEXT,
    'status',        p_status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION fn_create_stock_adjustment(UUID, TEXT, adjustment_type, UUID, UUID, TEXT, TEXT, JSONB, TEXT)
  TO authenticated, service_role;

-- 5. fn_approve_stock_adjustment — Admin approve retur pending
CREATE OR REPLACE FUNCTION fn_approve_stock_adjustment(
  p_adjustment_id UUID,
  p_admin_id      UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_adj    RECORD;
  v_item   RECORD;
  v_before INTEGER;
  v_after  INTEGER;
  v_delta  INTEGER;
  v_reason TEXT;
BEGIN
  SELECT * INTO v_adj FROM stock_adjustments
    WHERE id = p_adjustment_id FOR UPDATE;
  IF v_adj IS NULL THEN
    RAISE EXCEPTION 'Penyesuaian stok tidak ditemukan';
  END IF;
  IF v_adj.status <> 'pending' THEN
    RAISE EXCEPTION 'Hanya transaksi pending yang bisa di-approve (status saat ini: %)', v_adj.status;
  END IF;

  PERFORM set_config('app.allow_stok_update', 'true', true);

  FOR v_item IN
    SELECT * FROM stock_adjustment_items WHERE adjustment_id = p_adjustment_id
  LOOP
    SELECT stok INTO v_before FROM products WHERE id = v_item.product_id FOR UPDATE;

    IF v_adj.type = 'sales_return' THEN
      IF v_item.kondisi = 'bagus' THEN
        v_delta  := v_item.qty;
        v_reason := 'Retur pelanggan (kondisi bagus, stok kembali)';
      ELSE
        v_delta  := 0;
        v_reason := 'Retur pelanggan (kondisi rusak, stok tidak kembali)';
      END IF;
    ELSE
      v_delta  := 0;
      v_reason := 'Approval tipe ' || v_adj.type::TEXT;
    END IF;

    v_after := v_before + v_delta;

    IF v_after < 0 THEN
      RAISE EXCEPTION 'Stok tidak mencukupi untuk produk % (tersedia %, diminta %)',
        v_item.product_id, v_before, v_item.qty
        USING ERRCODE = '45R01';
    END IF;

    IF v_delta <> 0 THEN
      UPDATE products SET stok = v_after WHERE id = v_item.product_id;
    END IF;

    INSERT INTO stock_logs (
      product_id, user_id, delta_qty, stok_sebelum, stok_sesudah,
      source_type, rule_triggered, rule_action,
      reason_detail, context_payload
    ) VALUES (
      v_item.product_id, p_admin_id, v_delta, v_before, v_after,
      'adjustment', 'R4', 'ACCEPTED',
      v_reason || ' — Disetujui oleh admin — ' || v_adj.alasan,
      jsonb_build_object(
        'adjustment_id',   p_adjustment_id,
        'adjustment_type', v_adj.type::TEXT,
        'kondisi',         v_item.kondisi,
        'qty',             v_item.qty,
        'harga_satuan',    v_item.harga_satuan,
        'created_by',      v_adj.user_id,
        'approved_by',     p_admin_id
      )
    );
  END LOOP;

  PERFORM set_config('app.allow_stok_update', 'false', true);

  UPDATE stock_adjustments
  SET status = 'approved', approved_by = p_admin_id, approved_at = NOW()
  WHERE id = p_adjustment_id;

  RETURN jsonb_build_object(
    'adjustment_id', p_adjustment_id,
    'status',        'approved',
    'approved_by',   p_admin_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION fn_approve_stock_adjustment(UUID, UUID)
  TO authenticated, service_role;

-- 6. fn_reject_stock_adjustment — Admin tolak retur pending
CREATE OR REPLACE FUNCTION fn_reject_stock_adjustment(
  p_adjustment_id UUID,
  p_admin_id      UUID,
  p_reason        TEXT DEFAULT ''
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_adj RECORD;
BEGIN
  SELECT * INTO v_adj FROM stock_adjustments
    WHERE id = p_adjustment_id FOR UPDATE;
  IF v_adj IS NULL THEN
    RAISE EXCEPTION 'Penyesuaian stok tidak ditemukan';
  END IF;
  IF v_adj.status <> 'pending' THEN
    RAISE EXCEPTION 'Hanya transaksi pending yang bisa ditolak (status: %)', v_adj.status;
  END IF;

  UPDATE stock_adjustments
  SET status      = 'rejected',
      approved_by = p_admin_id,
      approved_at = NOW(),
      catatan     = COALESCE(catatan, '')
                    || CASE WHEN TRIM(COALESCE(p_reason, '')) <> ''
                       THEN E'\n[Ditolak] ' || p_reason ELSE '' END
  WHERE id = p_adjustment_id;

  INSERT INTO stock_logs (
    product_id, user_id, delta_qty, stok_sebelum, stok_sesudah,
    source_type, rule_triggered, rule_action,
    reason_detail, context_payload
  )
  SELECT
    sai.product_id, p_admin_id, 0, p.stok, p.stok,
    'adjustment', 'R4', 'REJECTED',
    'Retur pelanggan DITOLAK — ' || COALESCE(NULLIF(TRIM(p_reason), ''), 'Tanpa alasan'),
    jsonb_build_object(
      'adjustment_id',   p_adjustment_id,
      'adjustment_type', v_adj.type::TEXT,
      'qty',             sai.qty,
      'created_by',      v_adj.user_id,
      'rejected_by',     p_admin_id
    )
  FROM stock_adjustment_items sai
  JOIN products p ON p.id = sai.product_id
  WHERE sai.adjustment_id = p_adjustment_id;

  RETURN jsonb_build_object(
    'adjustment_id', p_adjustment_id,
    'status',        'rejected',
    'rejected_by',   p_admin_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION fn_reject_stock_adjustment(UUID, UUID, TEXT)
  TO authenticated, service_role;
