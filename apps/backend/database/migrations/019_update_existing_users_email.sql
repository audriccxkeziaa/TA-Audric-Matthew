-- =================================================================
-- Migration 019: Update existing users email to match new format
-- Format: username@pos.local
-- =================================================================

-- Step 1: Update email untuk semua users yang belum match format
UPDATE users
SET email = username || '@pos.local'
WHERE email NOT LIKE '%@pos.local%'
  AND username IS NOT NULL
  AND email IS NOT NULL;

-- Step 2: Verify hasil update (jalankan ini untuk cek)
-- SELECT id, username, email FROM users;
