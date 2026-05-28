-- Migration 005 — Row Level Security
-- Backend pakai SERVICE ROLE key (bypass RLS) — policy berikut hanya
-- bertindak sebagai pengaman tambahan jika kelak ada akses langsung
-- dari frontend dengan JWT user.
-- Helper: ambil role current user dari tabel users (kalau JWT terpasang)
CREATE OR REPLACE FUNCTION fn_current_role()
RETURNS TEXT AS $$
  SELECT role::text FROM users WHERE id = auth.uid();
$$ LANGUAGE sql STABLE;

-- ---------- USERS ----------
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_self_select ON users;
CREATE POLICY users_self_select ON users
  FOR SELECT USING (id = auth.uid() OR fn_current_role() = 'admin');

DROP POLICY IF EXISTS users_admin_modify ON users;
CREATE POLICY users_admin_modify ON users
  FOR ALL USING (fn_current_role() = 'admin')
  WITH CHECK (fn_current_role() = 'admin');

-- ---------- PRODUCTS ----------
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS products_authed_select ON products;
CREATE POLICY products_authed_select ON products
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS products_authed_modify ON products;
CREATE POLICY products_authed_modify ON products
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ---------- SALES + ITEMS ----------
ALTER TABLE sales       ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sales_authed_all ON sales;
CREATE POLICY sales_authed_all ON sales
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS sale_items_authed_all ON sale_items;
CREATE POLICY sale_items_authed_all ON sale_items
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ---------- PURCHASES + ITEMS ----------
ALTER TABLE purchases       ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS purchases_authed_all ON purchases;
CREATE POLICY purchases_authed_all ON purchases
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS purchase_items_authed_all ON purchase_items;
CREATE POLICY purchase_items_authed_all ON purchase_items
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ---------- STOCK LOGS ----------
ALTER TABLE stock_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stock_logs_authed_select ON stock_logs;
CREATE POLICY stock_logs_authed_select ON stock_logs
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS stock_logs_authed_insert ON stock_logs;
CREATE POLICY stock_logs_authed_insert ON stock_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
