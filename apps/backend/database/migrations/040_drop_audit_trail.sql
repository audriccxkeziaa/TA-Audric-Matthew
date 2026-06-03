-- Migration 040 — Hapus tabel audit_trail (sudah tidak terpakai)
--
-- Audit pengeluaran kini ditulis ke stock_logs (source_type='manual'), sama
-- seperti audit lain yang tampil di menu /audit-trail. Tabel audit_trail
-- (migrasi 033) tidak lagi dibaca/ditulis oleh kode mana pun → dihapus agar
-- skema bersih. DROP TABLE otomatis menghapus index & RLS policy miliknya.

DROP TABLE IF EXISTS audit_trail CASCADE;
