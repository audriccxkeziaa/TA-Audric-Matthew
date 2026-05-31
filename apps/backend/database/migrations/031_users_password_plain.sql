-- Migration 031 — Simpan password plain-text untuk admin melihat password kasir
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_plain TEXT;
