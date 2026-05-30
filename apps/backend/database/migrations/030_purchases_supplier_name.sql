-- Migration 030 — Tambah kolom supplier_name di purchases & purchase_drafts
ALTER TABLE purchases       ADD COLUMN IF NOT EXISTS supplier_name TEXT;
ALTER TABLE purchase_drafts ADD COLUMN IF NOT EXISTS supplier_name TEXT;
