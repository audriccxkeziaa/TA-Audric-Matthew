-- Migration 029 — Tambah kolom profil user: nama_lengkap & no_telepon
ALTER TABLE users ADD COLUMN IF NOT EXISTS nama_lengkap TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS no_telepon   VARCHAR(20);
