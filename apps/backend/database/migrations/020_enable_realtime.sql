-- 020: Enable Supabase Realtime untuk tabel-tabel utama
-- Supaya perubahan stok, transaksi, dan data lain langsung ter-broadcast
-- ke semua klien (kasir + admin) yang sedang online.

ALTER PUBLICATION supabase_realtime ADD TABLE products;
ALTER PUBLICATION supabase_realtime ADD TABLE sales;
ALTER PUBLICATION supabase_realtime ADD TABLE sale_items;
ALTER PUBLICATION supabase_realtime ADD TABLE purchases;
ALTER PUBLICATION supabase_realtime ADD TABLE purchase_items;
ALTER PUBLICATION supabase_realtime ADD TABLE users;
ALTER PUBLICATION supabase_realtime ADD TABLE stock_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE expenses;
