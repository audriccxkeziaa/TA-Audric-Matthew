-- Migration 045 — Diskon level-nota pada draft stok masuk
--
-- BUG: "Diskon Akhir Nota (%)" & "Potongan Harga (Rp)" adalah state level-nota,
-- tapi tabel purchase_drafts tidak punya kolomnya → saat Save/Update Draft nilai
-- ini hilang dan tidak pulih saat draft di-resume. Tambah kolomnya (tipe samakan
-- dengan tabel purchases dari migrasi 016).
--
-- Idempoten: ADD COLUMN IF NOT EXISTS aman dijalankan ulang.

ALTER TABLE purchase_drafts ADD COLUMN IF NOT EXISTS diskon_persen  NUMERIC(5,2)  DEFAULT 0;
ALTER TABLE purchase_drafts ADD COLUMN IF NOT EXISTS potongan_harga NUMERIC(14,2) DEFAULT 0;
