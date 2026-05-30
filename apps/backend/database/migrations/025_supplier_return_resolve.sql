-- Migration 025 — Retur Supplier 2 Tahap
-- Tahap 1 (Kirim Retur): stok berkurang, status='approved' (sudah berjalan via 022/023).
-- Tahap 2 (Barang Ganti Datang): fn_resolve_supplier_return → stok bertambah, status='selesai'.
--
-- Perubahan:
--   1. Tambah nilai 'selesai' ke constraint status
--   2. Fungsi baru fn_resolve_supplier_return(adjustment_id, admin_id)

-- 1. Perbarui constraint agar 'selesai' diizinkan
ALTER TABLE stock_adjustments DROP CONSTRAINT IF EXISTS chk_adj_status;
ALTER TABLE stock_adjustments
  ADD CONSTRAINT chk_adj_status
  CHECK (status IN ('pending', 'approved', 'rejected', 'selesai'));

-- 2. RPC Tahap 2: admin konfirmasi barang ganti sudah diterima → stok bertambah
CREATE OR REPLACE FUNCTION fn_resolve_supplier_return(
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
BEGIN
  SELECT * INTO v_adj FROM stock_adjustments
    WHERE id = p_adjustment_id FOR UPDATE;
  IF v_adj IS NULL THEN
    RAISE EXCEPTION 'Retur tidak ditemukan';
  END IF;
  IF v_adj.type <> 'return_supplier' THEN
    RAISE EXCEPTION 'Aksi ini hanya berlaku untuk retur ke supplier';
  END IF;
  IF v_adj.status <> 'approved' THEN
    RAISE EXCEPTION 'Retur sudah diselesaikan atau dalam status tidak valid (status: %)', v_adj.status;
  END IF;

  PERFORM set_config('app.allow_stok_update', 'true', true);

  FOR v_item IN
    SELECT * FROM stock_adjustment_items WHERE adjustment_id = p_adjustment_id
  LOOP
    SELECT stok INTO v_before FROM products WHERE id = v_item.product_id FOR UPDATE;
    v_after := v_before + v_item.qty;

    UPDATE products SET stok = v_after WHERE id = v_item.product_id;

    INSERT INTO stock_logs (
      product_id, user_id, delta_qty, stok_sebelum, stok_sesudah,
      source_type, rule_triggered, rule_action,
      reason_detail, context_payload
    ) VALUES (
      v_item.product_id, p_admin_id, v_item.qty, v_before, v_after,
      'adjustment', 'R4', 'ACCEPTED',
      'Barang ganti retur supplier diterima — ' || v_adj.alasan,
      jsonb_build_object(
        'adjustment_id',   p_adjustment_id,
        'adjustment_type', 'return_supplier',
        'phase',           'resolve_replacement',
        'qty',             v_item.qty,
        'harga_satuan',    v_item.harga_satuan,
        'resolved_by',     p_admin_id
      )
    );
  END LOOP;

  PERFORM set_config('app.allow_stok_update', 'false', true);

  UPDATE stock_adjustments
    SET status = 'selesai', approved_by = p_admin_id, approved_at = NOW()
    WHERE id = p_adjustment_id;

  RETURN jsonb_build_object(
    'adjustment_id', p_adjustment_id,
    'status',        'selesai',
    'resolved_by',   p_admin_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION fn_resolve_supplier_return(UUID, UUID)
  TO authenticated, service_role;
