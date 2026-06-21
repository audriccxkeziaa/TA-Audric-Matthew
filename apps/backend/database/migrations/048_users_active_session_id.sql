-- Migration 048 — Single Session (Last-Login-Wins)
-- Tambah kolom untuk melacak sesi aktif per user. Login baru membuat
-- active_session_id baru → request lama dengan session id berbeda ditolak
-- (lihat authMiddleware.js: perbandingan header X-Session-Id).

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS active_session_id text;
