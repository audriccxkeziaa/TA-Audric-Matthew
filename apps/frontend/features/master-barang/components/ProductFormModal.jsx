"use client";
// Modal tambah / edit barang — murni UI. Semua state & mutation ada di
// hook useProductForm. Kolom stok TIDAK bisa diedit manual (R3); min_stock
// hanya bisa diubah admin.

import { Modal, Button, Input } from "@/components/ui";
import { useProductForm } from "../hooks/useProductForm";

export function ProductFormModal({ open, onClose, editing, isAdmin }) {
  const { isEdit, form, set, alasan, setAlasan, err, submit, saving } =
    useProductForm({ editing, isAdmin, onClose });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Barang" : "Tambah Barang Baru"}
    >
      <div className="space-y-3">
        <Input
          label="Kode Barang"
          value={form.kode_barang}
          onChange={(e) => set("kode_barang", e.target.value)}
          placeholder="mis. SCM-001"
        />
        <Input
          label="Nama Barang"
          value={form.nama_barang}
          onChange={(e) => set("nama_barang", e.target.value)}
          placeholder="mis. Kampas Rem Beat"
        />
        <Input
          label="Merk"
          value={form.merk}
          onChange={(e) => set("merk", e.target.value)}
          placeholder="mis. Aspira"
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Harga Beli"
            type="number"
            min="0"
            value={form.harga_beli}
            onChange={(e) => set("harga_beli", e.target.value)}
          />
          <Input
            label="Harga Jual"
            type="number"
            min="0"
            value={form.harga_jual}
            onChange={(e) => set("harga_jual", e.target.value)}
          />
        </div>
        <Input
          label={`Min. Stok ${isAdmin ? "" : "(admin saja)"}`}
          type="number"
          min="0"
          value={form.min_stock}
          disabled={!isAdmin}
          onChange={(e) => set("min_stock", e.target.value)}
        />

        {/* Alasan perubahan — WAJIB saat edit (admin) untuk audit trail */}
        {isEdit && isAdmin && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Alasan Perubahan <span className="text-red-500">*</span>
            </label>
            <textarea
              value={alasan}
              onChange={(e) => setAlasan(e.target.value)}
              rows={3}
              placeholder="mis. Penyesuaian harga jual karena harga supplier naik / Koreksi nama barang typo"
              className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        )}

        {err && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {err}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
