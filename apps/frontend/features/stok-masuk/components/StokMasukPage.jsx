"use client";
// /stok-masuk — Input Stok Masuk via OCR / Manual. Orkestrator UI.
// Alur: Step 1 upload/mode → Step 2 validasi → commit (R2). Logika di useStokMasuk.

import { PageShell, PageHeader, Button, Badge, Modal, ConfirmDialog } from "@/components/ui";
import { rupiah } from "@/lib/format";
import ProductPicker from "@/components/ProductPicker";
import { useStokMasuk } from "../hooks/useStokMasuk";
import { UploadStep } from "./UploadStep";
import { ValidateStep } from "./ValidateStep";

export default function StokMasukPage() {
  const m = useStokMasuk();

  return (
    <PageShell>
      <PageHeader
        title="Stok Masuk"
        description="Input stok masuk via teknologi OCR atau input manual."
      />

      {/* Stepper — selalu terlihat */}
      <div className="mb-3 flex shrink-0 items-center gap-2 text-xs font-medium">
        <span
          className={`rounded-full px-3 py-1 ${
            m.step === "upload" ? "bg-brand-600 text-white" : "bg-slate-200 text-slate-500"
          }`}
        >
          1. {m.inputMode === "manual" ? "Pilih Mode" : "Upload Nota"}
        </span>
        <span className="text-slate-300">→</span>
        <span
          className={`rounded-full px-3 py-1 ${
            m.step === "validate" ? "bg-brand-600 text-white" : "bg-slate-200 text-slate-500"
          }`}
        >
          2. {m.inputMode === "manual" ? "Input & Konfirmasi" : "Validasi & Konfirmasi"}
        </span>
      </div>

      {m.step === "upload" && <UploadStep m={m} />}
      {m.step === "validate" && <ValidateStep m={m} />}

      {/* ============ MODAL: konfirmasi klasifikasi ambigu ============ */}
      <Modal
        open={Boolean(m.ambiguous)}
        onClose={() => m.setAmbiguous(null)}
        title="Konfirmasi Jenis Nota"
      >
        <p className="text-sm text-slate-600">
          Sistem tidak yakin jenis nota ini (Strategi 1). Mohon pilih agar pipeline
          preprocessing yang tepat dijalankan:
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            onClick={() => {
              m.setAmbiguous(null);
              m.runOcr("cetak");
            }}
            className="rounded-lg border-2 border-slate-200 p-4 text-center hover:border-brand-500"
          >
            <p className="font-semibold text-slate-800">Cetak Komputer</p>
            <p className="mt-1 text-xs text-slate-400">Pipeline sharp</p>
          </button>
          <button
            onClick={() => {
              m.setAmbiguous(null);
              m.runOcr("tulisan_tangan");
            }}
            className="rounded-lg border-2 border-slate-200 p-4 text-center hover:border-brand-500"
          >
            <p className="font-semibold text-slate-800">Tulisan Tangan</p>
            <p className="mt-1 text-xs text-slate-400">Pipeline opencv</p>
          </button>
        </div>
      </Modal>

      {/* ============ MODAL: pilih produk manual ============ */}
      <ProductPicker
        open={Boolean(m.pickerRowUid)}
        onClose={() => m.setPickerRowUid(null)}
        onSelect={m.pickProductForRow}
      />

      {/* ============ DIALOG: konfirmasi hapus draft ============ */}
      <ConfirmDialog
        open={Boolean(m.confirmDelete)}
        onClose={() => m.setConfirmDelete(null)}
        onConfirm={() => m.removeDraft(m.confirmDelete)}
        title="Hapus Draft?"
        message="Draft beserta hasil OCR-nya akan dihapus permanen. Lanjutkan?"
        confirmLabel="Yes, delete"
      />

      {/* ============ MODAL: hasil commit ============ */}
      <Modal open={Boolean(m.done)} onClose={m.resetAll} title="Stok Masuk Tersimpan">
        {m.done && (
          <div>
            <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              Data Pembelian tersimpan. Stok spareparts sudah terupdate otomatis ke database
              dan tercatat di audit trail.
            </div>
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">No. Nota</dt>
                <dd className="font-medium">{m.done.no_nota_supplier || "-"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Jumlah item</dt>
                <dd className="font-medium">{m.done.items?.length || 0}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Subtotal</dt>
                <dd className="font-medium">{rupiah(m.done.total)}</dd>
              </div>
              {m.done.products_created > 0 && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Produk baru dibuat</dt>
                  <dd className="font-medium">{m.done.products_created}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-slate-500">Status validasi</dt>
                <dd>
                  <Badge tone="green">{m.done.status_validasi}</Badge>
                </dd>
              </div>
            </dl>
            <div className="mt-4 flex justify-end">
              <Button onClick={m.resetAll}>Input Other Purchase Invoice</Button>
            </div>
          </div>
        )}
      </Modal>
    </PageShell>
  );
}
