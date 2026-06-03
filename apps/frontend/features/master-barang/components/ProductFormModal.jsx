"use client";
// Modal tambah / edit barang — murni UI. Semua state & mutation ada di
// hook useProductForm. Kolom stok TIDAK bisa diedit manual (R3); min_stock
// hanya bisa diubah admin. Merk via MerkPopup (popup searchable).
// Admin dapat nonaktifkan/aktifkan kembali produk (status toggle).

import { Modal, Button, Input, Textarea } from "@/components/ui";
import { MerkPopup } from "@/components/MerkPopup";
import { useProductForm } from "../hooks/useProductForm";

export function ProductFormModal({ open, onClose, editing, isAdmin, merkList = [] }) {
  const {
    isEdit,
    form,
    set,
    alasan,
    setAlasan,
    err,
    submit,
    saving,
    toggleStatus,
    togglingStatus,
  } = useProductForm({ editing, isAdmin, onClose });

  const isDiscontinue = editing?.status === "nonaktif";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Barang" : "Tambah Barang Baru"}
    >
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label={<>Kode Barang <span className="text-red-500">*</span></>}
            value={form.kode_barang}
            onChange={(e) => set("kode_barang", e.target.value)}
            placeholder="mis. SCM-001"
          />
          <Input
            label={<>Nama Barang <span className="text-red-500">*</span></>}
            value={form.nama_barang}
            onChange={(e) => set("nama_barang", e.target.value)}
            placeholder="mis. Kampas Rem Beat"
          />
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-700">
            Merk <span className="text-red-500">*</span>
          </span>
          <MerkPopup
            value={form.merk}
            onChange={(v) => set("merk", v)}
            merkList={merkList}
            placeholder="Pilih atau buat merk..."
          />
        </div>

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
        {Number(form.harga_jual) > 0 && Number(form.harga_jual) <= Number(form.harga_beli) ? (
          <p className="-mt-1 text-[11px] font-medium text-red-600">
            Harga jual harus lebih besar dari harga beli (mencegah penjualan rugi).
          </p>
        ) : (
          <p className="-mt-1 text-[11px] text-slate-400">
            Harga jual harus lebih besar dari harga beli.
          </p>
        )}

        <Input
          label={`Min. Stok ${isAdmin ? "" : "(admin saja)"}`}
          type="number"
          min="0"
          value={form.min_stock}
          disabled={!isAdmin}
          onChange={(e) => set("min_stock", e.target.value)}
        />

        {/* Alasan perubahan — WAJIB saat edit (admin) untuk audit trail & toggle status */}
        {isEdit && isAdmin && (
          <Textarea
            label={
              <>
                Alasan Perubahan <span className="text-red-500">*</span>
              </>
            }
            value={alasan}
            onChange={(e) => setAlasan(e.target.value)}
            rows={3}
            placeholder="mis. Penyesuaian harga jual karena harga supplier naik / Koreksi nama barang typo"
          />
        )}

        {err && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {err}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          {/* Toggle status produk — admin & edit saja */}
          {isEdit && isAdmin && (
            <Button
              variant={isDiscontinue ? "success" : "danger"}
              onClick={toggleStatus}
              disabled={togglingStatus || saving}
              size="sm"
            >
              {togglingStatus
                ? "Memproses..."
                : isDiscontinue
                ? "Aktifkan Kembali"
                : "Nonaktifkan Produk"}
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={saving || togglingStatus}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
