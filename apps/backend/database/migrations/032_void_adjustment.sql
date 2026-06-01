-- Migration 032 — Void/Cancel Adjustment (Pembatalan Retur)
-- Status 'cancelled' + fn_void_adjustment: reversal stok & update status.

-- 1. Perbarui constraint status (tambah 'cancelled')
ALTER TABLE stock_adjustments DROP CONSTRAINT IF EXISTS chk_adj_status;
ALTER TABLE stock_adjustments ADD CONSTRAINT chk_adj_status
  CHECK (status IN ('pending', 'approved', 'rejected', 'selesai', 'cancelled'));

-- 2. Fungsi void: reversal stok + set status='cancelled' (atomik)
CREATE OR REPLACE FUNCTION fn_void_adjustment(
  p_adjustment_id UUID,
  p_admin_id      UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_adj   RECORD;
  v_item  RECORD;
  v_before INTEGER;
  v_after  INTEGER;
  v_delta  INTEGER;
BEGIN
  -- Kunci baris dan baca header
  SELECT * INTO v_adj FROM stock_adjustments
    WHERE id = p_adjustment_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dokumen retur tidak ditemukan';
  END IF;

  IF v_adj.status NOT IN ('approved', 'selesai') THEN
    RAISE EXCEPTION
      'Hanya dokumen berstatus approved atau selesai yang dapat dibatalkan (status saat ini: %)',
      v_adj.status;
  END IF;

  -- Izinkan update stok melewati trigger R3
  PERFORM set_config('app.allow_stok_update', 'true', true);

  -- Balik stok untuk setiap item
  FOR v_item IN
    SELECT * FROM stock_adjustment_items WHERE adjustment_id = p_adjustment_id
  LOOP
    SELECT stok INTO v_before FROM products WHERE id = v_item.product_id FOR UPDATE;

    -- Arah pembalikan:
    --   sales_return  (approved) → awalnya +qty  → void -qty
    --   return_supplier (selesai) → Tahap 2 +qty  → void -qty
    --   return_supplier (approved)→ Tahap 1 -qty  → void +qty
    --   stock_adjustment (approved)→ -qty          → void +qty
    IF v_adj.type = 'sales_return' THEN
      v_delta := -v_item.qty;
    ELSIF v_adj.type = 'return_supplier' AND v_adj.status = 'selesai' THEN
      v_delta := -v_item.qty;
    ELSE
      v_delta := v_item.qty;
    END IF;

    v_after := v_before + v_delta;

    IF v_after < 0 THEN
      RAISE EXCEPTION
        'Stok tidak cukup untuk membalik dokumen — produk % stok % tidak cukup untuk dikurangi % unit',
        v_item.product_id, v_before, ABS(v_delta);
    END IF;

    UPDATE products SET stok = v_after WHERE id = v_item.product_id;

    INSERT INTO stock_logs (
      product_id, user_id, delta_qty, stok_sebelum, stok_sesudah,
      source_type, rule_triggered, rule_action, reason_detail, context_payload
    ) VALUES (
      v_item.product_id, p_admin_id, v_delta, v_before, v_after,
      'adjustment', 'R4', 'ACCEPTED',
      'Void/Batalkan — ' || v_adj.kode_adjustment || ': ' || v_adj.alasan,
      jsonb_build_object(
        'adjustment_id',   p_adjustment_id,
        'adjustment_type', v_adj.type,
        'phase',           'void',
        'original_qty',    v_item.qty,
        'reversal_qty',    v_delta,
        'voided_by',       p_admin_id
      )
    );
  END LOOP;

  PERFORM set_config('app.allow_stok_update', 'false', true);

  -- Set status ke cancelled
  UPDATE stock_adjustments
    SET status      = 'cancelled',
        approved_by = p_admin_id,
        approved_at = NOW()
    WHERE id = p_adjustment_id;

  RETURN jsonb_build_object(
    'adjustment_id', p_adjustment_id,
    'status',        'cancelled',
    'voided_by',     p_admin_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION fn_void_adjustment(UUID, UUID) TO authenticated, service_role;
