"use client";
// Step 2 — validasi & konfirmasi: info klasifikasi, pratinjau nota (OCR),
// daftar ItemRow, ringkasan + diskon nota, dan aksi (cancel/draft/commit).

import { Card, Button, Input, Badge } from "@/components/ui";
import { rupiah } from "@/lib/format";
import { ItemRow } from "./ItemRow";

export function ValidateStep({ m }) {
  return (
    <div className="flex flex-col gap-3 md:min-h-0 md:flex-1 md:overflow-auto thin-scroll">
      {/* Info klasifikasi & kualitas — hanya untuk OCR */}
      {m.inputMode === "ocr" && (
        <Card className="flex flex-wrap items-center gap-3 p-3 text-sm">
          <Badge tone={m.isHandwritten ? "amber" : "blue"}>
            {m.isHandwritten ? "Tulisan Tangan" : "Cetak Komputer"}
          </Badge>
          {m.isHandwritten && (
            <span className="text-xs text-amber-600">
              Field kuning = confidence &lt; 70, mohon periksa ekstra.
            </span>
          )}
        </Card>
      )}

      {/* Manual mode header with No. Nota input */}
      {m.inputMode === "manual" && (
        <Card className="flex flex-wrap items-center gap-4 p-4">
          <Badge tone="green">Input Manual</Badge>
          <div className="flex-1 min-w-[200px]">
            <Input
              label="No. Nota Supplier *"
              value={m.noNota}
              onChange={(e) => m.setNoNota(e.target.value)}
              placeholder="mis. INV-2026-0481"
            />
          </div>
        </Card>
      )}

      {/* Grid: preview (OCR) + tabel item */}
      <div className={`flex flex-col gap-4 ${m.inputMode === "ocr" ? "md:grid md:grid-cols-3" : ""}`}>
        {/* Preview nota — hanya untuk OCR */}
        {m.inputMode === "ocr" && (
          <Card className="flex flex-col p-3 md:col-span-1">
            <p className="mb-2 shrink-0 text-sm font-semibold text-slate-700">Pratinjau Nota</p>
            <div className="overflow-auto thin-scroll">
              {m.ocr?.file_nota_signed_url ? (
                <img src={m.ocr.file_nota_signed_url} alt="Nota" className="w-full rounded-lg border border-slate-200" />
              ) : m.previewUrl ? (
                <img src={m.previewUrl} alt="Nota" className="w-full rounded-lg border border-slate-200" />
              ) : (
                <p className="text-xs text-slate-400">Pratinjau tidak tersedia.</p>
              )}
              {m.ocr?.raw_text && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-slate-500">Lihat teks mentah OCR</summary>
                  <pre className="mt-1 max-h-48 overflow-auto thin-scroll whitespace-pre-wrap rounded bg-slate-50 p-2 text-[11px] text-slate-600">
                    {m.ocr.raw_text}
                  </pre>
                </details>
              )}
            </div>
          </Card>
        )}

        {/* Tabel validasi */}
        <Card className={`flex flex-col p-3 ${m.inputMode === "ocr" ? "md:col-span-2" : ""}`}>
          <div className="mb-2 flex shrink-0 items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">
              Item Stok Masuk ({m.rows.length})
            </p>
            <Button size="sm" variant="outline" onClick={m.addManualRow}>
              + Add Row
            </Button>
          </div>

          <div ref={m.rowsContainerRef} className="space-y-3 pr-1">
            {m.rows.map((row, idx) => (
              <ItemRow
                key={row.uid}
                index={idx}
                row={row}
                isHandwritten={m.isHandwritten}
                merkList={m.merkList}
                onPatch={(p) => m.patchRow(row.uid, p)}
                onRemove={() => m.removeRow(row.uid)}
                onDecisionChange={(v) => m.onDecisionChange(row, v)}
              />
            ))}
            {m.rows.length === 0 && (
              <p className="py-6 text-center text-sm text-slate-400">
                Belum ada item. Tambahkan baris manual.
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* Ringkasan & Diskon Nota */}
      {m.rows.length > 0 && (
        <Card className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px]">
              <span className="block text-xs font-medium text-slate-500 mb-1">
                Subtotal ({m.rows.length} item)
              </span>
              <span className="text-base font-semibold text-slate-800">{rupiah(m.subtotalBarang)}</span>
            </div>
            <div className="min-w-[120px]">
              <span className="block text-xs font-medium text-slate-500 mb-1">Diskon (%)</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={m.diskonPersen}
                  onChange={(e) => m.setDiskonPersen(e.target.value)}
                  placeholder="0"
                  className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                />
                <span className="text-sm text-slate-400">%</span>
              </div>
              {Number(m.diskonPersen) > 0 && (
                <span className="mt-0.5 block text-[11px] text-slate-400">
                  −{rupiah(Math.round(m.subtotalBarang * Math.min(Number(m.diskonPersen), 100) / 100))}
                </span>
              )}
            </div>
            <div className="min-w-[140px]">
              <span className="block text-xs font-medium text-slate-500 mb-1">Potongan Harga (Rp)</span>
              <input
                type="number"
                min="0"
                step="1000"
                value={m.potonganHarga}
                onChange={(e) => m.setPotonganHarga(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div className="min-w-[140px] text-right">
              <span className="block text-xs font-medium text-slate-500 mb-1">Total</span>
              <span className="text-lg font-bold text-brand-700">{rupiah(m.grandTotal)}</span>
            </div>
          </div>
        </Card>
      )}

      {/* Aksi — sticky di bawah area scroll agar tombol Save selalu terlihat */}
      <Card className="flex flex-wrap items-center justify-between gap-3 p-3 sticky bottom-0 z-10 shadow-[0_-2px_8px_rgba(0,0,0,0.08)]">
        <div className="text-sm text-slate-500">
          {m.canCommit ? (
            <span className="text-emerald-600">Semua item siap dikonfirmasi.</span>
          ) : !m.noNota.trim() ? (
            <span className="text-red-600">No. Nota Supplier wajib diisi sebelum menyimpan.</span>
          ) : (
            <span>
              Pastikan semua kolom sudah terisi agar tombol 'Confirm & Save' aktif.
              {m.isHandwritten && " serta tandai 'Diperiksa'"}
            </span>
          )}
          {m.draftSavedInfo && (
            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
              💾 Draft tersimpan ·{" "}
              {m.draftSavedInfo.when.toLocaleTimeString("id-ID")} ·{" "}
              {m.draftSavedInfo.count} item
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={m.resetAll}>
            Cancel
          </Button>
          {m.inputMode === "ocr" && (
            <Button
              variant="outline"
              onClick={m.saveDraft}
              disabled={m.savingDraft || !m.ocr?.file_nota_url}
              title="Simpan progres sekarang, koreksi sisanya nanti di laptop"
            >
              {m.savingDraft ? "Menyimpan..." : m.currentDraftId ? "Perbarui Draft" : "Save as Draft"}
            </Button>
          )}
          <Button onClick={m.commit} disabled={!m.canCommit || m.committing}>
            {m.committing ? "Saving..." : "Confirm & Save All"}
          </Button>
        </div>
      </Card>

      {/* Tips untuk pengguna mobile — hanya OCR */}
      {m.inputMode === "ocr" && (
        <Card className="shrink-0 border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-800 sm:hidden">
          Mode HP: jika tidak nyaman edit field di layar kecil, tekan{" "}
          <b>&quot;Simpan sebagai Draft&quot;</b>. Nota &amp; hasil OCR akan tersimpan, lalu buka
          halaman ini lagi di laptop untuk koreksi sebelum konfirmasi.
        </Card>
      )}
    </div>
  );
}
