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
