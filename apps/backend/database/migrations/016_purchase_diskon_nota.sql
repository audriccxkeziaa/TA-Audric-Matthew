-- =================================================================
-- Migration 015 — Diskon & Potongan Harga level nota pada purchases
-- =================================================================
-- Dua field terpisah:
--   diskon_persen   = persentase diskon nota (misal 5%)
--   potongan_harga  = potongan nominal Rupiah (misal Rp 50.000)
-- Total = sum(items) - (sum(items) * diskon_persen/100) - potongan_harga
-- =================================================================

ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS diskon_persen NUMERIC(5,2) NOT NULL DEFAULT 0
  CHECK (diskon_persen BETWEEN 0 AND 100);

ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS potongan_harga NUMERIC(14,2) NOT NULL DEFAULT 0
  CHECK (potongan_harga >= 0);

-- Drop semua overload lama
DROP FUNCTION IF EXISTS fn_commit_purchase(UUID, TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS fn_commit_purchase(UUID, TEXT, TEXT, JSONB, NUMERIC);

CREATE OR REPLACE FUNCTION fn_commit_purchase(
  p_user_id           UUID,
  p_no_nota_supplier  TEXT,
  p_file_nota_url     TEXT,
  p_items             JSONB,
  p_diskon_persen     NUMERIC DEFAULT 0,
  p_potongan_harga    NUMERIC DEFAULT 0
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_purchase_id      UUID;
  v_subtotal_items   NUMERIC(14,2) := 0;
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
  v_dpersen          NUMERIC(5,2);
  v_potong           NUMERIC(14,2);
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Items kosong: minimal 1 item';
  END IF;

  v_dpersen := COALESCE(p_diskon_persen, 0);
  v_potong  := COALESCE(p_potongan_harga, 0);

  INSERT INTO purchases (no_nota_supplier, user_id, total, status_validasi, file_nota_url, diskon_persen, potongan_harga)
  VALUES (p_no_nota_supplier, p_user_id, 0, 'tervalidasi', p_file_nota_url, v_dpersen, v_potong)
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

      SELECT id INTO v_existing_pid FROM products WHERE kode_barang = v_kode;
      IF v_existing_pid IS NOT NULL THEN
        v_product_id := v_existing_pid;
      ELSE
        INSERT INTO products (kode_barang, nama_barang, harga_beli, harga_jual, stok, min_stock, status)
        VALUES (
          v_kode, v_nama, v_harga_beli,
          COALESCE(NULLIF((v_item->>'harga_jual')::NUMERIC, 0), ROUND(v_harga_beli * 1.3, 0)),
          0, 0, 'aktif'
        )
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
    v_subtotal_items := v_subtotal_items + v_subtotal;
  END LOOP;

  v_total := GREATEST(v_subtotal_items - ROUND(v_subtotal_items * v_dpersen / 100.0, 2) - v_potong, 0);

  UPDATE purchases SET total = v_total WHERE id = v_purchase_id;

  RETURN jsonb_build_object(
    'purchase_id', v_purchase_id,
    'total', v_total,
    'diskon_persen', v_dpersen,
    'potongan_harga', v_potong,
    'products_created', v_products_created
  );
END;
$$;

GRANT EXECUTE ON FUNCTION fn_commit_purchase(UUID, TEXT, TEXT, JSONB, NUMERIC, NUMERIC) TO authenticated, service_role;
