-- Migration 018 — users.updated_at + auto-touch trigger
-- Menambahkan kolom updated_at pada tabel users supaya admin bisa
-- melihat kapan terakhir profil user diperbarui.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Trigger: setiap UPDATE → updated_at = NOW()
CREATE OR REPLACE FUNCTION fn_users_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_touch ON users;
CREATE TRIGGER trg_users_touch
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION fn_users_touch_updated_at();
