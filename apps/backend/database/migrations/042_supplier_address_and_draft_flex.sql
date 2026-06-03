-- Migration 042 — Alamat Supplier + Draft Stok Masuk yang lebih fleksibel
--
-- 1) Alamat supplier (opsional) pada nota pembelian. Disimpan per nota agar
--    "alamat terbaru" bisa diambil dari pembelian termutakhir supplier yang sama
--    (autofill di input stok masuk) tanpa membongkar nota lama yang sudah valid.
-- 2) Draft stok masuk kini mendukung MODE MANUAL (tanpa file nota) — kolom
--    file_nota_url dibuat nullable, dan input_mode disimpan agar resume lintas
--    perangkat memulihkan mode + form supplier dengan benar.
--
-- Idempoten: ADD COLUMN IF NOT EXISTS + DROP NOT NULL aman dijalankan ulang.

ALTER TABLE purchases       ADD COLUMN IF NOT EXISTS supplier_address TEXT;
ALTER TABLE purchase_drafts ADD COLUMN IF NOT EXISTS supplier_address TEXT;
ALTER TABLE purchase_drafts ADD COLUMN IF NOT EXISTS input_mode TEXT; -- 'ocr' | 'manual'

-- Draft manual tidak punya file nota → izinkan NULL.
ALTER TABLE purchase_drafts ALTER COLUMN file_nota_url DROP NOT NULL;
