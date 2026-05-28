-- Migration 014 — sale_items.diskon_persen (Diskon per item di POS)
-- Kasir bisa memberi diskon manual per baris di keranjang. Subtotal
-- final = qty * harga_satuan * (1 - diskon_persen/100). Default 0.
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
