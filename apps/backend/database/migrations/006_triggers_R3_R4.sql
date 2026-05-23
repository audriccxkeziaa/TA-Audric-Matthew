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
