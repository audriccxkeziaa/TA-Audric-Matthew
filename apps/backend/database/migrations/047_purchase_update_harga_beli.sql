-- Migration 047 — Stok masuk meng-update harga_beli produk ke harga batch terbaru
--
-- Sebelumnya: stok masuk (purchase_items) hanya MENAMBAH stok; harga_beli produk
-- di master TIDAK ikut berubah, sehingga harga beli baru dari supplier tidak
-- pernah tercermin sampai admin meng-edit manual.
--
-- Sekarang: setiap stok masuk yang tervalidasi juga memperbarui harga_beli produk
-- ke harga beli batch terbaru (NEW.harga_beli). Harga lama disimpan di
-- context_payload (harga_beli_lama) supaya perubahan tampil before→after di
-- halaman /audit-trail, sama seperti perubahan stok.
--
-- Catatan:
--   * harga_beli yang dipakai = harga beli per unit batch ini (kotor, sebelum
--     diskon) — konsisten dengan cara produk baru menyimpan harga_beli.
--   * Aturan R3 hanya memblok perubahan kolom `stok` (trigger BEFORE UPDATE OF
--     stok), jadi update harga_beli aman; stok tetap di dalam flag allow_stok_update.
--   * Idempoten: CREATE OR REPLACE. Hanya MENAMBAH perilaku update harga_beli &
--     field payload baru; alur lain (validasi, R1/R3/R4) tidak berubah.

CREATE OR REPLACE FUNCTION fn_purchase_items_apply()
RETURNS TRIGGER AS $$
DECLARE
  v_before     INTEGER;
  v_after      INTEGER;
  v_user       UUID;
  v_status     purchase_validation;
  v_harga_lama NUMERIC(14,2);
BEGIN
  -- Hanya proses jika header purchases status_validasi='tervalidasi'
  SELECT user_id, status_validasi INTO v_user, v_status
    FROM purchases WHERE id = NEW.purchase_id;

  IF v_status IS DISTINCT FROM 'tervalidasi' THEN
    -- Stok tidak ditambah; biarkan baris item tetap masuk sebagai draft.
    RETURN NEW;
  END IF;

  -- Ambil stok & harga_beli lama (kunci baris produk).
  SELECT stok, harga_beli INTO v_before, v_harga_lama
    FROM products WHERE id = NEW.product_id FOR UPDATE;
  IF v_before IS NULL THEN
    RAISE EXCEPTION 'Produk % tidak ditemukan saat memproses purchase_items', NEW.product_id;
  END IF;

  v_after := v_before + NEW.qty;

  -- Tambah stok DAN perbarui harga_beli ke harga batch terbaru. Satu UPDATE,
  -- di dalam flag R3 (kolom stok ikut berubah; harga_beli bebas dari R3).
  PERFORM set_config('app.allow_stok_update', 'true', true);
  UPDATE products
     SET stok = v_after,
         harga_beli = NEW.harga_beli
   WHERE id = NEW.product_id;
  PERFORM set_config('app.allow_stok_update', 'false', true);

  INSERT INTO stock_logs (
    product_id, user_id, delta_qty, stok_sebelum, stok_sesudah,
    source_type, rule_triggered, rule_action, reason_detail, context_payload
  ) VALUES (
    NEW.product_id, v_user, NEW.qty, v_before, v_after,
    'purchase', 'R4', 'ACCEPTED',
    'Stok bertambah otomatis oleh trigger R4 (purchase_items insert)',
    jsonb_build_object(
      'purchase_id',      NEW.purchase_id,
      'purchase_item_id', NEW.id,
      'qty',              NEW.qty,
      'harga_beli',       NEW.harga_beli,
      'harga_beli_lama',  v_harga_lama,
      'diskon_persen',    NEW.diskon_persen,
      'diskon_nominal',   NEW.diskon_nominal,
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
