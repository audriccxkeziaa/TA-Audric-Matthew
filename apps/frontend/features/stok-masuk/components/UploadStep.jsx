"use client";
// Step 1 — pilih mode (OCR / manual) + form upload nota (PC drag&drop / HP kamera)
// + daftar draft. Menerima objek hook `m` dari useStokMasuk.

import { Card, Button, Input, Select, Spinner } from "@/components/ui";
import { DraftsPanel } from "./DraftsPanel";
import { SupplierCombobox } from "./SupplierCombobox";
import { CameraCapture } from "./CameraCapture";

export function UploadStep({ m }) {
  return (
    <div className="space-y-4 thin-scroll md:min-h-0 md:flex-1 md:overflow-auto">
      {/* Daftar Draft (Cross-device Resume) */}
      <DraftsPanel
        drafts={m.drafts}
        loading={m.draftsLoading}
        onOpen={m.loadDraft}
        onDelete={(id) => m.setConfirmDelete(id)}
        onRefresh={m.refreshDrafts}
      />

      {/* Mode selector */}
      <div className="grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => m.setInputMode("ocr")}
          className={`group relative rounded-xl border-2 p-6 text-left transition ${
            m.inputMode === "ocr"
              ? "border-brand-500 bg-brand-50 shadow-sm"
              : "border-slate-200 bg-white hover:border-brand-300 hover:shadow-sm"
          }`}
        >
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100 text-brand-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-slate-800">Upload Nota Pembelian (OCR)</p>
          <p className="mt-1 text-xs text-slate-500">
            Upload foto/scan nota supplier, sistem akan membaca otomatis menggunakan teknologi OCR.
          </p>
          {m.inputMode === "ocr" && (
            <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-white">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            </div>
          )}
        </button>

        <button
          type="button"
          onClick={m.startManualInput}
          className="group relative rounded-xl border-2 border-slate-200 bg-white p-6 text-left transition hover:border-emerald-300 hover:shadow-sm"
        >
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-slate-800">Input Nota Pembelian (Manual)</p>
          <p className="mt-1 text-xs text-slate-500">
            Input data stok masuk spareparts. Direkomendasikan untuk nota yang kualitasnya buruk/rusak.
          </p>
        </button>
      </div>

      {/* OCR upload form — hanya tampil saat mode OCR dipilih */}
      {m.inputMode === "ocr" && (
        <Card className="p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Nama Supplier <span className="text-red-500">*</span>
              </label>
              <SupplierCombobox
                value={m.supplierName}
                onChange={m.setSupplierName}
                supplierList={m.supplierList}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <Input
              label="No. Nota Supplier *"
              value={m.noNota}
              onChange={(e) => m.setNoNota(e.target.value)}
              placeholder="mis. INV-2026-0481"
            />
          </div>
          <div className="mt-4">
            <Select
              label="Jenis Nota"
              value={m.notaTypeChoice}
              onChange={(e) => m.setNotaTypeChoice(e.target.value)}
            >
              <option value="auto">Automatic Detection (Strategi 1)</option>
              <option value="cetak">Computer Preview</option>
              <option value="tulisan_tangan">Handwriting</option>
            </Select>
          </div>

          {/* Upload area — tampilan berbeda untuk PC vs HP */}
          {m.isMobile ? (
            /* ===== HP / Tablet ===== */
            <div className="mt-4 space-y-3">
              {m.file && (
                <div className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 p-4">
                  {m.previewUrl ? (
                    <img src={m.previewUrl} alt="Pratinjau nota" className="max-h-56 rounded-lg border border-slate-200" />
                  ) : (
                    <div className="rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-600">{m.file.name}</div>
                  )}
                  <p className="text-xs text-slate-500">{m.file.name}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => m.setCameraOpen(true)}
                  className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand-400 bg-brand-50 p-5 text-brand-700 transition hover:bg-brand-100"
                >
                  <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                  </svg>
                  <span className="text-sm font-medium">Foto dengan Kamera</span>
                </button>
                <button
                  type="button"
                  onClick={() => m.fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-5 text-slate-600 transition hover:border-slate-400 hover:bg-slate-100"
                >
                  <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                  </svg>
                  <span className="text-sm font-medium">Pilih dari File</span>
                </button>
              </div>
              {/* Hidden inputs HP */}
              <input
                ref={m.cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => m.pickFile(e.target.files?.[0])}
              />
              <input
                ref={m.fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => m.pickFile(e.target.files?.[0])}
              />
            </div>
          ) : (
            /* ===== PC / Laptop — Drag & Drop ===== */
            <div
              onDragOver={(e) => {
                e.preventDefault();
                m.setDragOver(true);
              }}
              onDragLeave={() => m.setDragOver(false)}
              onDrop={m.onDrop}
              onClick={() => m.fileInputRef.current?.click()}
              className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition ${
                m.dragOver ? "border-brand-500 bg-brand-50" : "border-slate-300 hover:border-brand-400"
              }`}
            >
              <input
                ref={m.fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => m.pickFile(e.target.files?.[0])}
              />
              {m.file ? (
                <div className="flex flex-col items-center gap-2">
                  {m.previewUrl ? (
                    <img src={m.previewUrl} alt="Pratinjau nota" className="max-h-56 rounded-lg border border-slate-200" />
                  ) : (
                    <div className="rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-600">{m.file.name}</div>
                  )}
                  <p className="text-xs text-slate-500">{m.file.name} — klik untuk ganti file</p>
                </div>
              ) : (
                <>
                  <p className="text-sm font-medium text-slate-600">
                    Drag &amp; drop file nota di sini, atau klik untuk pilih
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Format: JPG / PNG / WebP / PDF — maks 10 MB
                  </p>
                </>
              )}
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <Button size="lg" disabled={!m.file || m.ocrLoading} onClick={() => m.runOcr()}>
              {m.ocrLoading ? "Processing OCR..." : "Process OCR"}
            </Button>
          </div>

          {m.ocrLoading && (
            <div className="mt-4 flex justify-center">
              <Spinner label="File nota sedang diproses, mohon tunggu..." />
            </div>
          )}
        </Card>
      )}

      {/* Kamera in-app (getUserMedia). Fallback ke kamera bawaan (<input capture>)
          bila izin ditolak / tidak didukung. */}
      {m.cameraOpen && (
        <CameraCapture
          onCapture={m.onCameraCapture}
          onClose={() => m.setCameraOpen(false)}
          onFallback={() => {
            m.setCameraOpen(false);
            m.cameraInputRef.current?.click();
          }}
        />
      )}
    </div>
  );
}
