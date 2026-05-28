-- Migration 013 — Expenses (Pengeluaran Operasional) & Saldo
-- Tabel pengeluaran operasional yang DI LUAR pembelian supplier
-- (gaji karyawan, listrik, air, sewa, dsb). Pembelian supplier
-- otomatis ikut potong saldo karena diambil dari tabel purchases
-- yang status_validasi='tervalidasi' (lihat view v_finance_summary).
--
-- Formula saldo bersih:
--   saldo_bersih = omset_kotor (sales)
--                  - total_pembelian_supplier (purchases tervalidasi)
--                  - total_pengeluaran_operasional (expenses)
DO $$ BEGIN
  CREATE TYPE expense_kind AS ENUM ('gaji', 'listrik', 'air', 'sewa', 'lainnya');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS expenses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jenis       expense_kind NOT NULL DEFAULT 'lainnya',
  deskripsi   TEXT NOT NULL,
  nominal     NUMERIC(14,2) NOT NULL CHECK (nominal > 0),
  tanggal     DATE NOT NULL DEFAULT CURRENT_DATE,
  user_id     UUID NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_tanggal ON expenses (tanggal DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_jenis   ON expenses (jenis);
CREATE INDEX IF NOT EXISTS idx_expenses_user    ON expenses (user_id);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS expenses_authed_select ON expenses;
CREATE POLICY expenses_authed_select ON expenses
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS expenses_authed_modify ON expenses;
CREATE POLICY expenses_authed_modify ON expenses
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ---------- View ringkasan keuangan ----------
-- Param-less view; filter tanggal dilakukan di backend pakai aggregation.
-- Tetap disediakan view all-time untuk kebutuhan summary cepat.
CREATE OR REPLACE VIEW v_finance_summary_alltime AS
SELECT
  COALESCE((SELECT SUM(total_harga) FROM sales), 0)                                              AS omset_kotor,
  COALESCE((SELECT SUM(total) FROM purchases WHERE status_validasi = 'tervalidasi'), 0)          AS total_pembelian,
  COALESCE((SELECT SUM(nominal) FROM expenses), 0)                                               AS total_pengeluaran,
  COALESCE((SELECT SUM(total_harga) FROM sales), 0)
    - COALESCE((SELECT SUM(total) FROM purchases WHERE status_validasi = 'tervalidasi'), 0)
    - COALESCE((SELECT SUM(nominal) FROM expenses), 0)                                           AS saldo_bersih;
