"use client";
// Modal tambah / edit pengeluaran operasional — murni UI (hook useExpenseForm).

import { Modal, Button, Input, Select } from "@/components/ui";
import { JENIS_OPTIONS } from "../lib/constants";
import { useExpenseForm } from "../hooks/useExpenseForm";

export function ExpenseFormModal({ open, onClose, editing, onDelete }) {
  const f = useExpenseForm({ editing, onClose });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={f.isEdit ? "Edit Pengeluaran Operasional" : "Tambah Pengeluaran Operasional"}
    >
      <div className="space-y-3">
        <Select
          label="Jenis Pengeluaran"
          value={f.jenis}
          onChange={(e) => f.setJenis(e.target.value)}
        >
          {JENIS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Input
          label={f.hint.label}
          placeholder={f.hint.placeholder}
          value={f.deskripsi}
          onChange={(e) => f.setDeskripsi(e.target.value)}
        />
        {f.jenis === "supplier" && (
          <p className="text-xs text-slate-500">
            Catatan: ini untuk pembelian supplier yang <b>tidak via OCR</b>.
            Pembelian dengan nota OCR tervalidasi sudah otomatis terhitung di
            kartu "Pembelian Supplier".
          </p>
        )}
        {f.jenis === "custom" && (
          <p className="text-xs text-slate-500">
            Isi label bebas — akan dijumlahkan di kotak "Custom" pada breakdown.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Nominal (Rp)"
            type="number"
            min="0"
            value={f.nominal}
            onChange={(e) => f.setNominal(e.target.value)}
          />
          <Input
            label="Tanggal"
            type="date"
            value={f.tgl}
            onChange={(e) => f.setTgl(e.target.value)}
          />
        </div>
        {f.err && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {f.err}
          </div>
        )}
        <div className="flex justify-between gap-2 pt-1">
          <div>
            {f.isEdit && (
              <Button
                variant="ghost"
                onClick={() => {
                  onClose();
                  setTimeout(() => onDelete?.(editing), 100);
                }}
                className="text-red-600 hover:bg-red-50"
              >
                Delete
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={f.submit} disabled={f.saving}>
              {f.saving ? "Saving..." : f.isEdit ? "Save changes" : "Save"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
