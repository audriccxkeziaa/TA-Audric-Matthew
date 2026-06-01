-- Migration 033 — Audit Trail
-- Tabel pencatatan aksi penting: pengeluaran, retur, approval.

CREATE TABLE IF NOT EXISTS audit_trail (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  action       TEXT NOT NULL,
  table_name   TEXT,
  record_id    UUID,
  old_value    JSONB,
  new_value    JSONB,
  rule_triggered TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_trail_created    ON audit_trail (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_trail_user       ON audit_trail (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_table      ON audit_trail (table_name);
CREATE INDEX IF NOT EXISTS idx_audit_trail_record     ON audit_trail (record_id);

-- RLS: admin bisa baca, semua bisa insert lewat service_role
ALTER TABLE audit_trail ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_trail_read  ON audit_trail FOR SELECT TO authenticated USING (true);
CREATE POLICY audit_trail_write ON audit_trail FOR INSERT TO service_role WITH CHECK (true);
GRANT INSERT ON audit_trail TO authenticated;
