"use client";
// =================================================================
// /stok-masuk — Input Stok Masuk via OCR Nota Supplier
// =================================================================
// Alur (Gambar 3.6 laporan):
//   Step 1  Upload nota  → POST /api/purchases/ocr
//   Step 2  Validasi hasil OCR (draft, status 'unsaved')
//   Step 3  Konfirmasi   → POST /api/purchases/commit (R2)
//
// Mendukung 3 status balasan OCR:
//   - unsaved                  → tampilkan form validasi
//   - ambiguous_classification → minta user pilih cetak / tulisan tangan
//   - manual_input_required    → buka input manual penuh (Strategi 4)
//
// Frontend TIDAK pernah mempercayai hasil OCR mentah — selalu draft +
// validasi user sebelum commit.
// =================================================================

import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { purchasesApi } from "@/lib/api";
import { useToast } from "@/hooks/useToast";
import { rupiah, persen } from "@/lib/format";
import ProductPicker from "@/components/ProductPicker";
import {
  PageShell,
  PageHeader,
  Card,
  Button,
  Input,
  Select,
  Badge,
  Spinner,
  Modal,
  EmptyState,
  ConfirmDialog,
} from "@/components/ui";

let rowSeq = 0;
const newUid = () => `row-${++rowSeq}`;

// Konversi item OCR backend → baris editable di tabel validasi.
function ocrItemToRow(item) {
  const raw = item.raw || {};
  const cands = item.candidates || [];
  // Pra-pilih kandidat teratas bila similarity cukup tinggi (>= 0.6).
  const top = cands[0];
  const preselect = top && top.similarity >= 0.6;
  return {
    uid: newUid(),
    source: "ocr",
    kode_barang: raw.kode_barang || "",
    nama_barang: raw.nama_barang || "",
    qty: raw.qty || 1,
    harga_beli: raw.harga_beli || 0,
    diskon_persen: raw.diskon_persen || 0,
    confidence: item.confidence || {},
    confidence_avg: item.confidence_avg,
    low_confidence: item.low_confidence,
    line_text: item.line_text || "",
    candidates: cands,
    action: preselect ? "restock" : null,
    product_id: preselect ? top.product_id : null,
    picked_label: preselect ? top.nama_barang : "",
    reviewed: false, // dipakai jalur tulisan tangan
  };
}

function blankManualRow() {
  return {
    uid: newUid(),
    source: "manual",
    kode_barang: "",
    nama_barang: "",
    qty: 1,
    harga_beli: 0,
    diskon_persen: 0,
    confidence: {},
    confidence_avg: null,
    low_confidence: false,
    line_text: "",
    candidates: [],
    action: null,
    product_id: null,
    picked_label: "",
    reviewed: true, // manual = sudah pasti diketik user
  };
}

export default function StokMasukPage() {
  const toast = useToast();
  const fileInputRef = useRef(null);

  const [step, setStep] = useState("upload"); // upload | validate
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [noNota, setNoNota] = useState("");
  const [notaTypeChoice, setNotaTypeChoice] = useState("auto"); // auto|cetak|tulisan_tangan
  const [dragOver, setDragOver] = useState(false);

  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocr, setOcr] = useState(null); // hasil mentah response.data
  const [ambiguous, setAmbiguous] = useState(null);
  const [rows, setRows] = useState([]);
  const [committing, setCommitting] = useState(false);
  const [pickerRowUid, setPickerRowUid] = useState(null);
  const [done, setDone] = useState(null);

  // --- Draft state (Cross-device Resume) -----------------------------
  // Skenario: kasir foto nota dari HP, jalan OCR, simpan draft, lalu
  // koreksi field-nya nanti di laptop. Edit di HP repot — jadi tombol
  // "Simpan Draft" diberi penekanan visual khusus saat di layar kecil.
  const [drafts, setDrafts] = useState([]);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [currentDraftId, setCurrentDraftId] = useState(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftSavedInfo, setDraftSavedInfo] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  // nota_type efektif untuk hasil OCR aktif (penentu highlight & aturan review)
  const notaType = ocr?.nota_type || null;
  const isHandwritten = notaType === "tulisan_tangan";

  // ---------- Pilih file ----------
  function pickFile(f) {
    if (!f) return;
    setFile(f);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(f.type.startsWith("image/") ? URL.createObjectURL(f) : "");
  }

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    pickFile(e.dataTransfer.files?.[0]);
  }

  // ---------- Proses OCR ----------
  async function runOcr(overrideType) {
    if (!file) {
      toast.error("Pilih file nota terlebih dahulu");
      return;
    }
    setOcrLoading(true);
    setAmbiguous(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (noNota.trim()) fd.append("no_nota_supplier", noNota.trim());
      const chosen = overrideType || notaTypeChoice;
      if (chosen && chosen !== "auto") fd.append("nota_type", chosen);

      const res = await purchasesApi.ocr(fd);
      const data = res.data;
      setOcr(data);

      if (data.status === "ambiguous_classification") {
        // Strategi 1 — sistem ragu, minta konfirmasi user.
        setAmbiguous(data.classification || {});
        toast.info("Sistem tidak yakin jenis nota — mohon konfirmasi");
        return;
      }

      if (data.status === "manual_input_required") {
        // Strategi 4 — kualitas OCR rendah, buka input manual penuh.
        setRows([blankManualRow()]);
        setStep("validate");
        toast.info(data.reason || "Silakan input manual");
        return;
      }

      // status 'unsaved' — tampilkan form validasi.
      const mapped = (data.items || []).map(ocrItemToRow);
      setRows(mapped.length ? mapped : [blankManualRow()]);
      setStep("validate");
      toast.success(`OCR selesai — ${mapped.length} item terbaca`);
    } catch (e) {
      toast.error(e.message || "Gagal memproses OCR");
    } finally {
      setOcrLoading(false);
    }
  }

  // ---------- Draft helpers ----------
  const refreshDrafts = useCallback(async () => {
    setDraftsLoading(true);
    try {
      const res = await purchasesApi.drafts.list();
      setDrafts(res.data || []);
    } catch (e) {
      // diam-diam saja — daftar draft bukan kritis
      console.warn("Gagal memuat draft:", e.message);
    } finally {
      setDraftsLoading(false);
    }
  }, []);

  // Load daftar draft saat kembali ke step upload (mis. setelah reset).
  useEffect(() => {
    if (step === "upload") refreshDrafts();
  }, [step, refreshDrafts]);

  // Map satu baris di tabel validasi → bentuk item untuk disimpan ke draft.
  // Tidak melakukan validasi (draft boleh setengah jadi).
  function rowToDraftItem(r) {
    return {
      source: r.source,
      kode_barang: r.kode_barang || "",
      nama_barang: r.nama_barang || "",
      qty: Number(r.qty) || 0,
      harga_beli: Number(r.harga_beli) || 0,
      diskon_persen: Number(r.diskon_persen) || 0,
      confidence: r.confidence || {},
      confidence_avg: r.confidence_avg ?? null,
      low_confidence: !!r.low_confidence,
      line_text: r.line_text || "",
      candidates: r.candidates || [],
      action: r.action || null,
      product_id: r.product_id || null,
      picked_label: r.picked_label || "",
      reviewed: !!r.reviewed,
    };
  }

  // Kebalikannya: item draft yg tersimpan → baris editable.
  function draftItemToRow(it) {
    return {
      uid: newUid(),
      source: it.source || "ocr",
      kode_barang: it.kode_barang || "",
      nama_barang: it.nama_barang || "",
      qty: it.qty || 1,
      harga_beli: it.harga_beli || 0,
      diskon_persen: it.diskon_persen || 0,
      confidence: it.confidence || {},
      confidence_avg: it.confidence_avg ?? null,
      low_confidence: !!it.low_confidence,
      line_text: it.line_text || "",
      candidates: it.candidates || [],
      action: it.action || null,
      product_id: it.product_id || null,
      picked_label: it.picked_label || "",
      reviewed: !!it.reviewed,
    };
  }

  async function saveDraft() {
    if (!ocr?.file_nota_url) {
      toast.error("Tidak ada nota terunggah — jalankan OCR dulu.");
      return;
    }
    setSavingDraft(true);
    try {
      const res = await purchasesApi.drafts.save({
        id: currentDraftId,
        no_nota_supplier: ocr?.no_nota_supplier || noNota.trim() || null,
        file_nota_url: ocr.file_nota_url,
        nota_type: ocr?.nota_type || null,
        raw_text: ocr?.raw_text || null,
        preprocessing: ocr?.preprocessing || null,
        quality: ocr?.quality || null,
        items: rows.map(rowToDraftItem),
        status: "draft",
      });
      setCurrentDraftId(res.data?.id || null);
      setDraftSavedInfo({
        when: new Date(),
        count: rows.length,
      });
      toast.success("Draft tersimpan — lanjutkan di laptop kapan saja.");
    } catch (e) {
      toast.error(e.message || "Gagal menyimpan draft");
    } finally {
      setSavingDraft(false);
    }
  }

  async function loadDraft(draftId) {
    setOcrLoading(true);
    try {
      const res = await purchasesApi.drafts.get(draftId);
      const d = res.data;
      setOcr({
        no_nota_supplier: d.no_nota_supplier,
        file_nota_url: d.file_nota_url,
        file_nota_signed_url: d.file_nota_signed_url,
        nota_type: d.nota_type,
        raw_text: d.raw_text,
        preprocessing: d.preprocessing,
        quality: d.quality,
      });
      setNoNota(d.no_nota_supplier || "");
      const items = Array.isArray(d.items) ? d.items : [];
      setRows(items.length ? items.map(draftItemToRow) : [blankManualRow()]);
      setCurrentDraftId(d.id);
      setStep("validate");
      toast.info("Draft dibuka — silakan lanjutkan koreksi.");
    } catch (e) {
      toast.error(e.message || "Gagal membuka draft");
    } finally {
      setOcrLoading(false);
    }
  }

  async function removeDraft(draftId) {
    try {
      await purchasesApi.drafts.remove(draftId);
      toast.success("Draft dihapus");
      setDrafts((arr) => arr.filter((d) => d.id !== draftId));
      if (currentDraftId === draftId) setCurrentDraftId(null);
    } catch (e) {
      toast.error(e.message || "Gagal menghapus draft");
    } finally {
      setConfirmDelete(null);
    }
  }

  // ---------- Operasi baris ----------
  function patchRow(uid, patch) {
    setRows((rs) => rs.map((r) => (r.uid === uid ? { ...r, ...patch } : r)));
  }
  function removeRow(uid) {
    setRows((rs) => rs.filter((r) => r.uid !== uid));
  }
  function addManualRow() {
    setRows((rs) => [...rs, blankManualRow()]);
  }

  // Ubah keputusan produk (dropdown kandidat).
  function onDecisionChange(row, value) {
    if (value === "") {
      patchRow(row.uid, { action: null, product_id: null, picked_label: "" });
    } else if (value === "new") {
      patchRow(row.uid, { action: "new", product_id: null, picked_label: "" });
    } else if (value === "search") {
      setPickerRowUid(row.uid);
    } else if (value.startsWith("cand:")) {
      const pid = value.slice(5);
      const c = row.candidates.find((x) => x.product_id === pid);
      patchRow(row.uid, {
        action: "restock",
        product_id: pid,
        picked_label: c ? c.nama_barang : row.picked_label,
      });
    }
  }

  // ---------- Validasi siap commit (R2 sisi klien) ----------
  const canCommit = useMemo(() => {
    if (rows.length === 0) return false;
    return rows.every((r) => {
      const qtyOk = Number(r.qty) > 0;
      const hargaOk = Number(r.harga_beli) >= 0;
      if (!qtyOk || !hargaOk) return false;
      if (r.action === "restock") {
        if (!r.product_id) return false;
      } else if (r.action === "new") {
        if (!r.kode_barang.trim() || !r.nama_barang.trim()) return false;
      } else {
        return false; // belum ada keputusan
      }
      // Strategi 3 — jalur tulisan tangan: tiap baris wajib ditandai diperiksa.
      if (isHandwritten && !r.reviewed) return false;
      return true;
    });
  }, [rows, isHandwritten]);

  // ---------- Commit (R2) ----------
  async function commit() {
    if (!canCommit) return;
    setCommitting(true);
    try {
      const items = rows.map((r) => {
        const base = {
          qty: parseInt(r.qty, 10) || 0,
          harga_beli: Number(r.harga_beli) || 0,
          diskon_persen: Number(r.diskon_persen) || 0,
          source: r.source,
        };
        if (r.action === "new") {
          return {
            ...base,
            action: "new",
            kode_barang: r.kode_barang.trim(),
            nama_barang: r.nama_barang.trim(),
          };
        }
        return { ...base, action: "restock", product_id: r.product_id };
      });

      const res = await purchasesApi.commit({
        no_nota_supplier: ocr?.no_nota_supplier || noNota.trim() || null,
        file_nota_url: ocr?.file_nota_url || null,
        // R2: status_validasi di-set 'tervalidasi' SETELAH user konfirmasi.
        status_validasi: "tervalidasi",
        items,
      });
      setDone(res.data);
      toast.success("Stok masuk berhasil disimpan — stok bertambah (R4)");
      // Bila draft sumber dari resume → bersihkan agar tidak tampil lagi.
      if (currentDraftId) {
        try {
          await purchasesApi.drafts.remove(currentDraftId);
        } catch {
          // diam — bukan fatal
        }
        setCurrentDraftId(null);
      }
    } catch (e) {
      // R2 reject (HTTP 400) bila status_validasi tidak 'tervalidasi'.
      toast.error(
        (e.rule ? `[${e.rule}] ` : "") + (e.message || "Gagal menyimpan")
      );
    } finally {
      setCommitting(false);
    }
  }

  function resetAll() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setStep("upload");
    setFile(null);
    setPreviewUrl("");
    setNoNota("");
    setNotaTypeChoice("auto");
    setOcr(null);
    setAmbiguous(null);
    setRows([]);
    setDone(null);
    setCurrentDraftId(null);
    setDraftSavedInfo(null);
  }

  // =================================================================
  // RENDER
  // =================================================================
  return (
    <PageShell>
      <PageHeader
        title="Stok Masuk (OCR Nota Supplier)"
        description="Unggah nota, validasi hasil OCR, lalu konfirmasi untuk menambah stok."
      />

      {/* Stepper — selalu terlihat */}
      <div className="mb-3 flex shrink-0 items-center gap-2 text-xs font-medium">
        <span
          className={`rounded-full px-3 py-1 ${
            step === "upload"
              ? "bg-brand-600 text-white"
              : "bg-slate-200 text-slate-500"
          }`}
        >
          1. Upload Nota
        </span>
        <span className="text-slate-300">→</span>
        <span
          className={`rounded-full px-3 py-1 ${
            step === "validate"
              ? "bg-brand-600 text-white"
              : "bg-slate-200 text-slate-500"
          }`}
        >
          2. Validasi &amp; Konfirmasi
        </span>
      </div>

      {/* ============ STEP 1: UPLOAD ============ */}
      {step === "upload" && (
        <div className="min-h-0 flex-1 space-y-4 overflow-auto thin-scroll">
        {/* Daftar Draft (Cross-device Resume) */}
        <DraftsPanel
          drafts={drafts}
          loading={draftsLoading}
          onOpen={loadDraft}
          onDelete={(id) => setConfirmDelete(id)}
          onRefresh={refreshDrafts}
        />

        <Card className="p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="No. Nota Supplier (opsional)"
              value={noNota}
              onChange={(e) => setNoNota(e.target.value)}
              placeholder="mis. INV-2026-0481"
            />
            <Select
              label="Jenis Nota"
              value={notaTypeChoice}
              onChange={(e) => setNotaTypeChoice(e.target.value)}
            >
              <option value="auto">Deteksi otomatis (Strategi 1)</option>
              <option value="cetak">Cetak komputer</option>
              <option value="tulisan_tangan">Tulisan tangan</option>
            </Select>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition ${
              dragOver
                ? "border-brand-500 bg-brand-50"
                : "border-slate-300 hover:border-brand-400"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              capture="environment"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
            {file ? (
              <div className="flex flex-col items-center gap-2">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Pratinjau nota"
                    className="max-h-56 rounded-lg border border-slate-200"
                  />
                ) : (
                  <div className="rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-600">
                    📄 {file.name}
                  </div>
                )}
                <p className="text-xs text-slate-500">
                  {file.name} — klik untuk ganti file
                </p>
              </div>
            ) : (
              <>
                <p className="text-sm font-medium text-slate-600">
                  Tarik &amp; lepas file nota di sini, atau klik untuk pilih
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Format: JPG / PNG / WebP / PDF — maks 10 MB. Di HP, kamera
                  akan terbuka langsung.
                </p>
              </>
            )}
          </div>

          <div className="mt-4 flex justify-end">
            <Button
              size="lg"
              disabled={!file || ocrLoading}
              onClick={() => runOcr()}
            >
              {ocrLoading ? "Memproses OCR..." : "Proses OCR"}
            </Button>
          </div>

          {ocrLoading && (
            <div className="mt-4 flex justify-center">
              <Spinner label="Menjalankan preprocessing + Tesseract — mohon tunggu..." />
            </div>
          )}
        </Card>
        </div>
      )}

      {/* ============ STEP 2: VALIDASI ============ */}
      {step === "validate" && (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          {/* Info klasifikasi & kualitas */}
          <Card className="flex flex-wrap items-center gap-3 p-3 text-sm">
            <Badge tone={isHandwritten ? "amber" : "blue"}>
              {isHandwritten ? "Tulisan Tangan" : "Cetak Komputer"}
            </Badge>
            {ocr?.preprocessing?.pipeline && (
              <span className="text-xs text-slate-400">
                Pipeline: {ocr.preprocessing.pipeline}
              </span>
            )}
            {ocr?.quality && (
              <span className="text-xs text-slate-400">
                Avg confidence:{" "}
                {Math.round(ocr.quality.avg_confidence || 0)} · Field kosong:{" "}
                {Math.round((ocr.quality.empty_pct || 0) * 100)}%
              </span>
            )}
            {isHandwritten && (
              <span className="text-xs text-amber-600">
                Field kuning = confidence &lt; 70, mohon periksa ekstra.
              </span>
            )}
          </Card>

          <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-3">
            {/* Preview nota */}
            <Card className="flex min-h-0 flex-col p-3 lg:col-span-1">
              <p className="mb-2 shrink-0 text-sm font-semibold text-slate-700">
                Pratinjau Nota
              </p>
              <div className="min-h-0 flex-1 overflow-auto thin-scroll">
              {ocr?.file_nota_signed_url ? (
                <img
                  src={ocr.file_nota_signed_url}
                  alt="Nota"
                  className="w-full rounded-lg border border-slate-200"
                />
              ) : previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Nota"
                  className="w-full rounded-lg border border-slate-200"
                />
              ) : (
                <p className="text-xs text-slate-400">Pratinjau tidak tersedia.</p>
              )}
              {ocr?.raw_text && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-slate-500">
                    Lihat teks mentah OCR
                  </summary>
                  <pre className="mt-1 max-h-48 overflow-auto thin-scroll whitespace-pre-wrap rounded bg-slate-50 p-2 text-[11px] text-slate-600">
                    {ocr.raw_text}
                  </pre>
                </details>
              )}
              </div>
            </Card>

            {/* Tabel validasi */}
            <Card className="flex min-h-0 flex-col p-3 lg:col-span-2">
              <div className="mb-2 flex shrink-0 items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">
                  Item Stok Masuk ({rows.length})
                </p>
                <Button size="sm" variant="outline" onClick={addManualRow}>
                  + Tambah Baris Manual
                </Button>
              </div>

              <div className="min-h-0 flex-1 space-y-3 overflow-auto thin-scroll pr-1">
                {rows.map((row, idx) => (
                  <ItemRow
                    key={row.uid}
                    index={idx}
                    row={row}
                    isHandwritten={isHandwritten}
                    onPatch={(p) => patchRow(row.uid, p)}
                    onRemove={() => removeRow(row.uid)}
                    onDecisionChange={(v) => onDecisionChange(row, v)}
                  />
                ))}
                {rows.length === 0 && (
                  <p className="py-6 text-center text-sm text-slate-400">
                    Belum ada item. Tambahkan baris manual.
                  </p>
                )}
              </div>
            </Card>
          </div>

          {/* Aksi — selalu terlihat */}
          <Card className="flex shrink-0 flex-wrap items-center justify-between gap-3 p-3">
            <div className="text-sm text-slate-500">
              {canCommit ? (
                <span className="text-emerald-600">
                  ✓ Semua item siap dikonfirmasi.
                </span>
              ) : (
                <span>
                  Lengkapi keputusan produk &amp; data tiap item
                  {isHandwritten && " serta tandai 'Diperiksa'"} untuk
                  mengaktifkan tombol konfirmasi (R2).
                </span>
              )}
              {draftSavedInfo && (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                  💾 Draft tersimpan ·{" "}
                  {draftSavedInfo.when.toLocaleTimeString("id-ID")} ·{" "}
                  {draftSavedInfo.count} item
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={resetAll}>
                Batal
              </Button>
              <Button
                variant="outline"
                onClick={saveDraft}
                disabled={savingDraft || !ocr?.file_nota_url}
                title="Simpan progres sekarang, koreksi sisanya nanti di laptop"
              >
                {savingDraft
                  ? "Menyimpan..."
                  : currentDraftId
                  ? "💾 Perbarui Draft"
                  : "💾 Simpan sebagai Draft"}
              </Button>
              <Button
                onClick={commit}
                disabled={!canCommit || committing}
              >
                {committing ? "Menyimpan..." : "Konfirmasi & Simpan Semua"}
              </Button>
            </div>
          </Card>

          {/* Tips untuk pengguna mobile */}
          <Card className="shrink-0 border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-800 sm:hidden">
            📱 <b>Mode HP:</b> jika tidak nyaman edit field di layar kecil,
            tekan <b>"💾 Simpan sebagai Draft"</b>. Nota & hasil OCR akan
            tersimpan, lalu buka halaman ini lagi di laptop untuk koreksi
            sebelum konfirmasi.
          </Card>
        </div>
      )}

      {/* ============ MODAL: konfirmasi klasifikasi ambigu ============ */}
      <Modal
        open={Boolean(ambiguous)}
        onClose={() => setAmbiguous(null)}
        title="Konfirmasi Jenis Nota"
      >
        <p className="text-sm text-slate-600">
          Sistem tidak yakin jenis nota ini (Strategi 1). Mohon pilih agar
          pipeline preprocessing yang tepat dijalankan:
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            onClick={() => {
              setAmbiguous(null);
              runOcr("cetak");
            }}
            className="rounded-lg border-2 border-slate-200 p-4 text-center hover:border-brand-500"
          >
            <p className="font-semibold text-slate-800">Cetak Komputer</p>
            <p className="mt-1 text-xs text-slate-400">Pipeline sharp</p>
          </button>
          <button
            onClick={() => {
              setAmbiguous(null);
              runOcr("tulisan_tangan");
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
        open={Boolean(pickerRowUid)}
        onClose={() => setPickerRowUid(null)}
        onSelect={(p) => {
          patchRow(pickerRowUid, {
            action: "restock",
            product_id: p.id,
            picked_label: p.nama_barang,
          });
        }}
      />

      {/* ============ DIALOG: konfirmasi hapus draft ============ */}
      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => removeDraft(confirmDelete)}
        title="Hapus Draft?"
        message="Draft beserta hasil OCR-nya akan dihapus permanen. Lanjutkan?"
        confirmLabel="Ya, hapus"
      />

      {/* ============ MODAL: hasil commit ============ */}
      <Modal
        open={Boolean(done)}
        onClose={resetAll}
        title="Stok Masuk Tersimpan"
      >
        {done && (
          <div>
            <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              Pembelian tersimpan. Stok produk sudah bertambah otomatis lewat
              trigger R4, dan tercatat di audit trail.
            </div>
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">No. Nota</dt>
                <dd className="font-medium">
                  {done.no_nota_supplier || "-"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Jumlah item</dt>
                <dd className="font-medium">{done.items?.length || 0}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Total nilai</dt>
                <dd className="font-medium">{rupiah(done.total)}</dd>
              </div>
              {done.products_created > 0 && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Produk baru dibuat</dt>
                  <dd className="font-medium">{done.products_created}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-slate-500">Status validasi</dt>
                <dd>
                  <Badge tone="green">{done.status_validasi}</Badge>
                </dd>
              </div>
            </dl>
            <div className="mt-4 flex justify-end">
              <Button onClick={resetAll}>Input Nota Lain</Button>
            </div>
          </div>
        )}
      </Modal>
    </PageShell>
  );
}

// =================================================================
// Komponen: satu baris item pada tabel validasi
// =================================================================
function ItemRow({
  index,
  row,
  isHandwritten,
  onPatch,
  onRemove,
  onDecisionChange,
}) {
  // Sorot kuning jika confidence field < 70 (khusus tulisan tangan).
  function fieldClass(field) {
    if (
      isHandwritten &&
      row.source === "ocr" &&
      typeof row.confidence?.[field] === "number" &&
      row.confidence[field] < 70
    ) {
      return "bg-amber-50 border-amber-300";
    }
    return "";
  }

  // Nilai select keputusan produk.
  let decisionValue = "";
  if (row.action === "new") decisionValue = "new";
  else if (row.action === "restock" && row.product_id)
    decisionValue = `cand:${row.product_id}`;

  // Kandidat tambahan bila produk terpilih dari pencarian manual
  // (tidak ada di daftar kandidat Levenshtein).
  const candidateInList = row.candidates.some(
    (c) => c.product_id === row.product_id
  );

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500">
          Item #{index + 1}{" "}
          {row.source === "ocr" ? (
            <Badge tone="blue">OCR</Badge>
          ) : (
            <Badge tone="slate">Manual</Badge>
          )}
          {row.source === "ocr" && typeof row.confidence_avg === "number" && (
            <span className="ml-1 text-slate-400">
              conf {row.confidence_avg}
            </span>
          )}
        </span>
        <button
          onClick={onRemove}
          className="text-xs text-red-500 hover:underline"
        >
          Hapus baris
        </button>
      </div>

      {row.line_text && (
        <p className="mb-2 truncate rounded bg-slate-50 px-2 py-1 text-[11px] text-slate-400">
          Teks OCR: {row.line_text}
        </p>
      )}

      {/* Keputusan produk */}
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">
          Cocokkan ke produk (rekomendasi Levenshtein top-3)
        </span>
        <select
          value={decisionValue}
          onChange={(e) => onDecisionChange(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">— Pilih tindakan —</option>
          {row.action === "restock" && !candidateInList && row.product_id && (
            <option value={`cand:${row.product_id}`}>
              {row.picked_label} (dipilih manual)
            </option>
          )}
          {row.candidates.map((c) => (
            <option key={c.product_id} value={`cand:${c.product_id}`}>
              {c.nama_barang} — {c.kode_barang} ({persen(c.similarity)})
            </option>
          ))}
          <option value="new">+ Buat produk baru (pakai kode &amp; nama)</option>
          <option value="search">🔍 Cari produk lain di katalog...</option>
        </select>
      </label>

      {row.action === "restock" && row.picked_label && (
        <p className="mt-1 text-xs text-emerald-600">
          → Restock: {row.picked_label}
        </p>
      )}
      {row.action === "new" && (
        <p className="mt-1 text-xs text-blue-600">
          → Produk baru akan dibuat dari kode &amp; nama di bawah.
        </p>
      )}

      {/* Field editable */}
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">
            Kode Barang
          </span>
          <input
            value={row.kode_barang}
            onChange={(e) => onPatch({ kode_barang: e.target.value })}
            className={`w-full rounded-lg border px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-brand-500 ${
              fieldClass("kode_barang") || "border-slate-300"
            }`}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">
            Nama Barang
          </span>
          <input
            value={row.nama_barang}
            onChange={(e) => onPatch({ nama_barang: e.target.value })}
            className={`w-full rounded-lg border px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-brand-500 ${
              fieldClass("nama_barang") || "border-slate-300"
            }`}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">Qty</span>
          <input
            type="number"
            min="1"
            value={row.qty}
            onChange={(e) => onPatch({ qty: e.target.value })}
            className={`w-full rounded-lg border px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-brand-500 ${
              fieldClass("qty") || "border-slate-300"
            }`}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">
            Harga Beli
          </span>
          <input
            type="number"
            min="0"
            value={row.harga_beli}
            onChange={(e) => onPatch({ harga_beli: e.target.value })}
            className={`w-full rounded-lg border px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-brand-500 ${
              fieldClass("harga_beli") || "border-slate-300"
            }`}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">
            Diskon (%)
          </span>
          <input
            type="number"
            min="0"
            max="100"
            value={row.diskon_persen}
            onChange={(e) => onPatch({ diskon_persen: e.target.value })}
            className={`w-full rounded-lg border px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-brand-500 ${
              fieldClass("diskon_persen") || "border-slate-300"
            }`}
          />
        </label>
      </div>

      {/* Strategi 3: checkbox 'Diperiksa' wajib untuk jalur tulisan tangan */}
      {isHandwritten && (
        <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={row.reviewed}
            onChange={(e) => onPatch({ reviewed: e.target.checked })}
          />
          Saya sudah memeriksa &amp; mengoreksi semua field baris ini
        </label>
      )}
    </div>
  );
}

// =================================================================
// Komponen: panel daftar Draft (Cross-device Resume)
// =================================================================
// Tampilkan kartu untuk tiap draft tersimpan agar bisa dilanjutkan
// di perangkat lain. Skenario utama: foto + OCR di HP, koreksi di laptop.
function DraftsPanel({ drafts, loading, onOpen, onDelete, onRefresh }) {
  if (!loading && (!drafts || drafts.length === 0)) {
    return null; // jangan tampilkan kalau kosong
  }

  function timeAgo(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    const diff = Math.max(0, Date.now() - d.getTime());
    const min = Math.floor(diff / 60000);
    if (min < 1) return "baru saja";
    if (min < 60) return `${min} menit lalu`;
    const jam = Math.floor(min / 60);
    if (jam < 24) return `${jam} jam lalu`;
    return d.toLocaleDateString("id-ID");
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">
            📥 Draft Tersimpan
            {drafts.length > 0 && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                {drafts.length}
              </span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Nota yang sudah ter-OCR di HP — buka di sini untuk dikoreksi &amp;
            dikonfirmasi.
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={onRefresh}>
          ↻ Muat ulang
        </Button>
      </div>

      {loading ? (
        <p className="py-2 text-center text-xs text-slate-400">
          Memuat draft...
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {drafts.map((d) => (
            <div
              key={d.id}
              className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50 p-2 transition hover:border-brand-400"
            >
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-white">
                {d.file_nota_signed_url ? (
                  <img
                    src={d.file_nota_signed_url}
                    alt="Nota"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                    📄
                  </div>
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">
                    {d.no_nota_supplier || "(tanpa no. nota)"}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
                    <Badge
                      tone={d.nota_type === "tulisan_tangan" ? "amber" : "blue"}
                    >
                      {d.nota_type === "tulisan_tangan"
                        ? "Tulisan Tangan"
                        : d.nota_type === "cetak"
                        ? "Cetak"
                        : "—"}
                    </Badge>
                    <span>{d.item_count} item</span>
                    <span>· {timeAgo(d.updated_at)}</span>
                  </p>
                </div>
                <div className="mt-2 flex justify-end gap-1">
                  <button
                    onClick={() => onDelete(d.id)}
                    className="rounded-md px-2 py-1 text-[11px] text-red-600 hover:bg-red-50"
                  >
                    Hapus
                  </button>
                  <button
                    onClick={() => onOpen(d.id)}
                    className="rounded-md bg-brand-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-brand-700"
                  >
                    Lanjutkan →
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
