-- Migration 027 — Index Performa untuk Query Laporan & Riwayat
-- Menambah index pada kolom yang sering difilter (created_at, FK join) agar
-- laporan dan tabel riwayat berjalan di bawah 1 detik meski data ribuan baris.

-- Laporan penjualan: filter by created_at
CREATE INDEX IF NOT EXISTS idx_sales_created_at
  ON sales(created_at DESC);

-- Laporan pembelian: filter by created_at
CREATE INDEX IF NOT EXISTS idx_purchases_created_at
  ON purchases(created_at DESC);

-- Join sale_items saat build laporan & struk
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id
  ON sale_items(sale_id);

-- Join purchase_items saat build laporan
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id
  ON purchase_items(purchase_id);

-- Audit trail: filter by created_at
CREATE INDEX IF NOT EXISTS idx_stock_logs_created_at
  ON stock_logs(created_at DESC);

-- Audit trail: filter by user
CREATE INDEX IF NOT EXISTS idx_stock_logs_user_id
  ON stock_logs(user_id);

-- Retur & penyesuaian: filter by type + status (HistoryTab)
CREATE INDEX IF NOT EXISTS idx_stock_adj_type_status
  ON stock_adjustments(type, status, created_at DESC);
