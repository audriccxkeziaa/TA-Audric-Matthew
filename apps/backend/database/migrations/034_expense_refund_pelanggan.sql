-- Migration 034 — Tambah nilai 'refund_pelanggan' ke enum expense_kind
-- Root cause: insert retur pelanggan ke expenses gagal diam-diam karena
-- 'refund_pelanggan' tidak ada di enum → saldo tidak terpengaruh.
--
-- ALTER TYPE ... ADD VALUE tidak bisa di dalam transaction block,
-- jalankan statement ini secara langsung di Supabase SQL Editor.

ALTER TYPE expense_kind ADD VALUE IF NOT EXISTS 'refund_pelanggan';
