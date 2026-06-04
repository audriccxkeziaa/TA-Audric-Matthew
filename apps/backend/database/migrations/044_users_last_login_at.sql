-- Migration 044 — "Terakhir Login" realtime
--
-- MASALAH: kolom "Terakhir Login" di Manajemen User dibaca dari
-- auth.users.last_sign_in_at (Supabase Auth). Tabel auth.users TIDAK ada di
-- publication `supabase_realtime`, jadi saat user lain login, halaman admin tidak
-- ter-update otomatis (harus refresh manual).
--
-- SOLUSI: simpan waktu login di public.users.last_login_at. Tabel public.users
-- SUDAH ada di publication realtime & di-watch useRealtimeSync → login controller
-- meng-update kolom ini setiap login sukses → event UPDATE tersiar ke admin →
-- daftar user refetch otomatis (realtime).
--
-- Idempoten: ADD COLUMN IF NOT EXISTS + backfill aman dijalankan ulang.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Backfill dari riwayat login Supabase Auth agar data lama tidak hilang
-- ("Belum pernah") setelah pindah sumber.
UPDATE public.users u
SET    last_login_at = a.last_sign_in_at
FROM   auth.users a
WHERE  a.id = u.id
  AND  a.last_sign_in_at IS NOT NULL
  AND  u.last_login_at IS NULL;
