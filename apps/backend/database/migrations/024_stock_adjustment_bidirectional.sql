-- Migration 024 — Penyesuaian Stok Dua Arah
-- stock_adjustment sekarang bisa MENAMBAH atau MENGURANGI stok.
-- Tiap item JSONB boleh menyertakan field "arah": "tambah" | "kurang" (default "kurang").
-- Perubahan backward-compatible: call lama tanpa field "arah" tetap berlaku sebagai "kurang".
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
  v_arah       TEXT;
  v_harga      NUMERIC(14,2);
  v_before     INTEGER;
  v_after      INTEGER;
  v_delta      INTEGER;
  v_reason     TEXT;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Items kosong: minimal 1 item';
  END IF;
  IF TRIM(COALESCE(p_alasan, '')) = '' THEN
    RAISE EXCEPTION 'Alasan wajib diisi';
  END IF;

  INSERT INTO stock_adjustments (
    kode_adjustment, type, user_id,
    reference_sale_id, reference_purchase_id,
    alasan, catatan
  ) VALUES (
    p_kode, p_type, p_user_id,
    p_reference_sale_id, p_reference_purchase_id,
    p_alasan, p_catatan
  ) RETURNING id INTO v_adj_id;

  PERFORM set_config('app.allow_stok_update', 'true', true);

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_qty        := (v_item->>'qty')::INTEGER;
    v_kondisi    := v_item->>'kondisi';
    v_arah       := COALESCE(v_item->>'arah', 'kurang');
    v_harga      := COALESCE((v_item->>'harga_satuan')::NUMERIC, 0);

    IF v_product_id IS NULL OR v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Item tidak valid: product_id dan qty wajib (qty > 0)';
    END IF;

    IF p_type = 'stock_adjustment' AND v_arah NOT IN ('tambah', 'kurang') THEN
      RAISE EXCEPTION 'Arah tidak valid untuk penyesuaian stok: harus ''tambah'' atau ''kurang''';
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
      IF v_arah = 'tambah' THEN
        v_delta  := v_qty;
        v_reason := 'Penyesuaian stok (koreksi tambah)';
      ELSE
        v_delta  := -v_qty;
        v_reason := 'Penyesuaian stok (penyusutan/koreksi kurang)';
      END IF;
    END IF;

    v_after := v_before + v_delta;

    IF v_after < 0 THEN
      RAISE EXCEPTION 'Stok tidak mencukupi untuk produk % (tersedia %, diminta %)',
        v_product_id, v_before, v_qty
        USING ERRCODE = '45R01';
    END IF;

    IF v_delta <> 0 THEN
      UPDATE products SET stok = v_after WHERE id = v_product_id;
    END IF;

    INSERT INTO stock_adjustment_items (adjustment_id, product_id, qty, kondisi, harga_satuan)
    VALUES (v_adj_id, v_product_id, v_qty, v_kondisi, v_harga);

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
        'arah',            v_arah,
        'kondisi',         v_kondisi,
        'qty',             v_qty,
        'harga_satuan',    v_harga,
        'alasan',          p_alasan
      )
    );

    v_total_qty := v_total_qty + v_qty;
  END LOOP;

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
