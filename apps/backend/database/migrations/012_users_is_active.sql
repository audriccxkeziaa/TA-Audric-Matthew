-- =================================================================
-- Migration 012 — users.is_active (soft-deactivate akun)
-- =================================================================
-- Dipakai authMiddleware untuk menolak request dari user yang sudah
-- dinonaktifkan admin, meski JWT-nya belum kedaluwarsa.
-- =================================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_users_is_active ON users (is_active);
