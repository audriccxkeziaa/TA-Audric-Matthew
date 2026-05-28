"use client";
// /stok-masuk — Input Stok Masuk via OCR Nota Supplier
// Alur :
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

import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { purchasesApi, productsApi } from "@/lib/api";
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
  const top = cands[0];
  const exactMatch = top && top.similarity >= 1.0;
  const hasHighMatch = top && top.similarity >= 0.8;
  const autoNew = top ? top.similarity < 0.8 : true;
  return {
    uid: newUid(),
    source: "ocr",
    kode_barang: raw.kode_barang || "",
    nama_barang: raw.nama_barang || "",
    merk: exactMatch ? (top?.merk || "") : (raw.merk || ""),
    qty: raw.qty || 1,
    harga_beli: raw.harga_beli || 0,
    harga_jual: 0,
    diskon_persen: raw.diskon_persen || 0,
    confidence: item.confidence || {},
    confidence_avg: item.confidence_avg,
    low_confidence: item.low_confidence,
    line_text: item.line_text || "",
    candidates: cands,
    action: exactMatch ? "restock" : autoNew ? "new" : null,
    product_id: exactMatch ? top.product_id : null,
    picked_label: exactMatch ? top.nama_barang : "",
    reviewed: false,
  };
}

function blankManualRow() {
  return {
    uid: newUid(),
    source: "manual",
    kode_barang: "",
    nama_barang: "",
    merk: "",
    qty: 1,
    harga_beli: 0,
    harga_jual: 0,
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
  const qc = useQueryClient();
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // Deteksi perangkat: true jika HP/tablet (touch + mobile UA)
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const touch = navigator.maxTouchPoints > 0;
    const mobileUA = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    setIsMobile(touch && mobileUA);
  }, []);

  const [step, setStep] = useState("upload"); // upload | validate
  const [inputMode, setInputMode] = useState(null); // null | "ocr" | "manual"
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
  const [diskonPersen, setDiskonPersen] = useState("");
  const [potonganHarga, setPotonganHarga] = useState("");

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

  // Cegah kehilangan data saat user tidak sengaja menutup/refresh/back browser
  useEffect(() => {
    if (step !== "validate" || rows.length === 0) return;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [step, rows.length]);

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
    setInputMode("ocr");
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
        toast.info("Sistem tidak yakin dengan jenis nota, mohon konfirmasi...");
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
      toast.success(`Proses OCR telah selesai, ${mapped.length} item terbaca`);
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
      merk: r.merk || "",
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
      merk: it.merk || "",
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
      toast.success("Draft berhasil disimpan.");
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
      toast.info("Draft dilanjutkan, silahkan edit kembali untuk disimpan.");
    } catch (e) {
      toast.error(e.message || "Gagal membuka draft");
    } finally {
      setOcrLoading(false);
    }
  }

  async function removeDraft(draftId) {
    try {
      await purchasesApi.drafts.remove(draftId);
      toast.success("Draft berhasil dihapus");
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
  const rowsContainerRef = useRef(null);
  function addManualRow() {
    setRows((rs) => [...rs, blankManualRow()]);
    setTimeout(() => {
      rowsContainerRef.current?.scrollTo({ top: rowsContainerRef.current.scrollHeight, behavior: "smooth" });
    }, 50);
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
        merk: c?.merk || row.merk || "",
      });
    }
  }

  // ---------- Validasi siap commit (R2 sisi klien) ----------
  const canCommit = useMemo(() => {
    if (rows.length === 0) return false;
    return rows.every((r) => {
      const qtyOk = Number(r.qty) > 0;
      const hargaOk = Number(r.harga_beli) > 0; // wajib > 0
      if (!qtyOk || !hargaOk) return false;
      if (r.action === "restock") {
        if (!r.product_id) return false;
      } else if (r.action === "new") {
        // kode, nama, merk wajib untuk produk baru
        if (!r.kode_barang.trim() || !r.nama_barang.trim()) return false;
        if (!r.merk?.trim()) return false;
      } else {
        return false; // belum ada keputusan
      }
      // Strategi 3 — jalur tulisan tangan: tiap baris wajib ditandai diperiksa.
      if (isHandwritten && !r.reviewed) return false;
      return true;
    });
  }, [rows, isHandwritten]);

  // ---------- Hitung subtotal & diskon nota ----------
  const subtotalBarang = useMemo(
    () => rows.reduce((s, r) => s + (Number(r.qty) || 0) * (Number(r.harga_beli) || 0), 0),
    [rows]
  );
  const diskonNilai = useMemo(() => {
    const pct = Math.min(Number(diskonPersen) || 0, 100);
    const pot = Number(potonganHarga) || 0;
    return Math.round(subtotalBarang * pct / 100) + pot;
  }, [diskonPersen, potonganHarga, subtotalBarang]);
  const grandTotal = Math.max(subtotalBarang - diskonNilai, 0);

  // ---------- Commit (R2) ----------
  async function commit() {
    if (!canCommit) return;
    setCommitting(true);
    try {
      const items = rows.map((r) => {
        const base = {
          qty: parseInt(r.qty, 10) || 0,
          harga_beli: Number(r.harga_beli) || 0,
          diskon_persen: 0,
          source: r.source,
        };
        if (r.action === "new") {
          const obj = {
            ...base,
            action: "new",
            kode_barang: r.kode_barang.trim(),
            nama_barang: r.nama_barang.trim(),
            merk: r.merk?.trim() || null,
          };
          if (Number(r.harga_jual) > 0) obj.harga_jual = Number(r.harga_jual);
          return obj;
        }
        return { ...base, action: "restock", product_id: r.product_id };
      });

      const res = await purchasesApi.commit({
        no_nota_supplier: ocr?.no_nota_supplier || noNota.trim() || null,
        file_nota_url: ocr?.file_nota_url || null,
        status_validasi: "tervalidasi",
        items,
        diskon_persen: Math.min(Number(diskonPersen) || 0, 100),
        potongan_harga: Number(potonganHarga) || 0,
      });
      setDone(res.data);
      toast.success("Stok masuk berhasil disimpan — stok bertambah (R4)");
      // Invalidasi cache restock & notif agar tampilan langsung terupdate.
      qc.invalidateQueries({ queryKey: ["restock"] });
      qc.invalidateQueries({ queryKey: ["notif-low-stock"] });
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
    // Hapus file nota dari Storage bila ada tapi belum disimpan ke draft
    if (ocr?.file_nota_url && !currentDraftId) {
      purchasesApi.deleteFile(ocr.file_nota_url).catch(() => {});
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setStep("upload");
    setInputMode(null);
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
    setDiskonPersen("");
    setPotonganHarga("");
  }

  function startManualInput() {
    setInputMode("manual");
    if (rows.length === 0) {
      setRows([blankManualRow(), blankManualRow(), blankManualRow()]);
    }
    setStep("validate");
  }

  function goBackToModeSelect() {
    setStep("upload");
  }

  // =================================================================
  // RENDER
  // =================================================================
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
            step === "upload"
              ? "bg-brand-600 text-white"
              : "bg-slate-200 text-slate-500"
          }`}
        >
          1. {inputMode === "manual" ? "Pilih Mode" : "Upload Nota"}
        </span>
        <span className="text-slate-300">→</span>
        <span
          className={`rounded-full px-3 py-1 ${
            step === "validate"
              ? "bg-brand-600 text-white"
              : "bg-slate-200 text-slate-500"
          }`}
        >
          2. {inputMode === "manual" ? "Input & Konfirmasi" : "Validasi & Konfirmasi"}
        </span>
      </div>

      {/* ============ STEP 1: UPLOAD / MODE SELECT ============ */}
      {step === "upload" && (
        <div className="space-y-4 thin-scroll md:min-h-0 md:flex-1 md:overflow-auto">
        {/* Daftar Draft (Cross-device Resume) */}
        <DraftsPanel
          drafts={drafts}
          loading={draftsLoading}
          onOpen={loadDraft}
          onDelete={(id) => setConfirmDelete(id)}
          onRefresh={refreshDrafts}
        />

        {/* Mode selector */}
        <div className="grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setInputMode("ocr")}
            className={`group relative rounded-xl border-2 p-6 text-left transition ${
              inputMode === "ocr"
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
            {inputMode === "ocr" && (
              <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-white">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              </div>
            )}
          </button>

          <button
            type="button"
            onClick={startManualInput}
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
        {inputMode === "ocr" && (
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

            {/* Upload area — tampilan berbeda untuk PC vs HP */}
            {isMobile ? (
              /* ===== HP / Tablet ===== */
              <div className="mt-4 space-y-3">
                {/* Preview file yang sudah dipilih */}
                {file && (
                  <div className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 p-4">
                    {previewUrl ? (
                      <img
                        src={previewUrl}
                        alt="Pratinjau nota"
                        className="max-h-56 rounded-lg border border-slate-200"
                      />
                    ) : (
                      <div className="rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-600">
                        {file.name}
                      </div>
                    )}
                    <p className="text-xs text-slate-500">{file.name}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  {/* Tombol kamera — buka kamera belakang langsung */}
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand-400 bg-brand-50 p-5 text-brand-700 transition hover:bg-brand-100"
                  >
                    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                    </svg>
                    <span className="text-sm font-medium">Foto dengan Kamera</span>
                  </button>
                  {/* Tombol pilih file dari galeri/storage */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
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
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => pickFile(e.target.files?.[0])}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => pickFile(e.target.files?.[0])}
                />
              </div>
            ) : (
              /* ===== PC / Laptop — Drag & Drop ===== */
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
                        {file.name}
                      </div>
                    )}
                    <p className="text-xs text-slate-500">
                      {file.name} — klik untuk ganti file
                    </p>
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
                <Spinner label="File nota sedang diproses, mohon tunggu..." />
              </div>
            )}
          </Card>
        )}
        </div>
      )}

      {/* ============ STEP 2: VALIDASI ============ */}
      {step === "validate" && (
        /* Wrapper ini scroll sendiri di desktop sehingga konten tidak pernah
           terpotong meski jendela browser sangat kecil. */
        <div className="flex flex-col gap-3 md:min-h-0 md:flex-1 md:overflow-auto thin-scroll">
          {/* Info klasifikasi & kualitas — hanya untuk OCR */}
          {inputMode === "ocr" && (
            <Card className="flex flex-wrap items-center gap-3 p-3 text-sm">
              <Badge tone={isHandwritten ? "amber" : "blue"}>
                {isHandwritten ? "Tulisan Tangan" : "Cetak Komputer"}
              </Badge>
              {isHandwritten && (
                <span className="text-xs text-amber-600">
                  Field kuning = confidence &lt; 70, mohon periksa ekstra.
                </span>
              )}
            </Card>
          )}

          {/* Manual mode header with No. Nota input */}
          {inputMode === "manual" && (
            <Card className="flex flex-wrap items-center gap-4 p-4">
              <Badge tone="green">Input Manual</Badge>
              <div className="flex-1 min-w-[200px]">
                <Input
                  label="No. Nota Supplier (opsional)"
                  value={noNota}
                  onChange={(e) => setNoNota(e.target.value)}
                  placeholder="mis. INV-2026-0481"
                />
              </div>
            </Card>
          )}

          {/* Grid: preview (OCR) + tabel item */}
          <div className={`flex flex-col gap-4 ${inputMode === "ocr" ? "md:grid md:grid-cols-3" : ""}`}>
            {/* Preview nota — hanya untuk OCR */}
            {inputMode === "ocr" && (
              <Card className="flex flex-col p-3 md:col-span-1">
                <p className="mb-2 shrink-0 text-sm font-semibold text-slate-700">
                  Pratinjau Nota
                </p>
                <div className="overflow-auto thin-scroll">
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
            )}

            {/* Tabel validasi — tinggi natural, tidak perlu flex-1 karena wrapper scroll */}
            <Card className={`flex flex-col p-3 ${inputMode === "ocr" ? "md:col-span-2" : ""}`}>
              <div className="mb-2 flex shrink-0 items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">
                  Item Stok Masuk ({rows.length})
                </p>
                <Button size="sm" variant="outline" onClick={addManualRow}>
                  + Add Row
                </Button>
              </div>

              <div ref={rowsContainerRef} className="space-y-3 pr-1">
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

          {/* Ringkasan & Diskon Nota */}
          {rows.length > 0 && (
            <Card className="p-4">
              <div className="flex flex-wrap items-end gap-4">
                <div className="flex-1 min-w-[200px]">
                  <span className="block text-xs font-medium text-slate-500 mb-1">
                    Subtotal ({rows.length} item)
                  </span>
                  <span className="text-base font-semibold text-slate-800">
                    {rupiah(subtotalBarang)}
                  </span>
                </div>
                <div className="min-w-[120px]">
                  <span className="block text-xs font-medium text-slate-500 mb-1">Diskon (%)</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={diskonPersen}
                      onChange={(e) => setDiskonPersen(e.target.value)}
                      placeholder="0"
                      className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <span className="text-sm text-slate-400">%</span>
                  </div>
                  {Number(diskonPersen) > 0 && (
                    <span className="mt-0.5 block text-[11px] text-slate-400">
                      −{rupiah(Math.round(subtotalBarang * Math.min(Number(diskonPersen), 100) / 100))}
                    </span>
                  )}
                </div>
                <div className="min-w-[140px]">
                  <span className="block text-xs font-medium text-slate-500 mb-1">Potongan Harga (Rp)</span>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={potonganHarga}
                    onChange={(e) => setPotonganHarga(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div className="min-w-[140px] text-right">
                  <span className="block text-xs font-medium text-slate-500 mb-1">Total</span>
                  <span className="text-lg font-bold text-brand-700">
                    {rupiah(grandTotal)}
                  </span>
                </div>
              </div>
            </Card>
          )}

          {/* Aksi — sticky di bawah area scroll agar tombol Save selalu terlihat */}
          <Card className="flex flex-wrap items-center justify-between gap-3 p-3 sticky bottom-0 z-10 shadow-[0_-2px_8px_rgba(0,0,0,0.08)]">
            <div className="text-sm text-slate-500">
              {canCommit ? (
                <span className="text-emerald-600">
                  Semua item siap dikonfirmasi.
                </span>
              ) : (
                <span>
                  Pastikan semua kolom sudah terisi agar tombol 'Konfirmasi dan Simpan' aktif. 
                  {isHandwritten && " serta tandai 'Diperiksa'"}
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
                Cancel
              </Button>
              {inputMode === "ocr" && (
                <Button
                  variant="outline"
                  onClick={saveDraft}
                  disabled={savingDraft || !ocr?.file_nota_url}
                  title="Simpan progres sekarang, koreksi sisanya nanti di laptop"
                >
                  {savingDraft
                    ? "Menyimpan..."
                    : currentDraftId
                    ? "Perbarui Draft"
                    : "Save as Draft"}
                </Button>
              )}
              <Button
                onClick={commit}
                disabled={!canCommit || committing}
              >
                {committing ? "Menyimpan..." : "Confirm & Save All"}
              </Button>
            </div>
          </Card>

          {/* Tips untuk pengguna mobile — hanya OCR */}
          {inputMode === "ocr" && (
            <Card className="shrink-0 border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-800 sm:hidden">
              Mode HP: jika tidak nyaman edit field di layar kecil,
              tekan <b>&quot;Simpan sebagai Draft&quot;</b>. Nota &amp; hasil OCR akan
              tersimpan, lalu buka halaman ini lagi di laptop untuk koreksi
              sebelum konfirmasi.
            </Card>
          )}
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
            merk: p.merk || "",
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
              Data Pembelian tersimpan. Stok spareparts sudah terupdate otomatis ke database
              dan tercatat di audit trail.
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
                <dt className="text-slate-500">Subtotal</dt>
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
              <Button onClick={resetAll}>Input Nota Pembelian Lain</Button>
            </div>
          </div>
        )}
      </Modal>
    </PageShell>
  );
}

// Komponen: input diskon fleksibel (% atau nominal Rp)
function DiskonInput({ diskonPersen, hargaBeli, fieldClass, onPatch }) {
  const [mode, setMode] = useState("persen"); // "persen" | "rupiah"
  const [rpValue, setRpValue] = useState("");

  const toggleMode = () => {
    if (mode === "persen") {
      const rp = hargaBeli > 0 ? Math.round((diskonPersen / 100) * hargaBeli) : 0;
      setRpValue(rp > 0 ? String(rp) : "");
      setMode("rupiah");
    } else {
      setMode("persen");
    }
  };

  const onPersenChange = (e) => {
    const v = Math.max(0, Math.min(100, Number(e.target.value) || 0));
    onPatch({ diskon_persen: v });
  };

  const onRupiahChange = (e) => {
    const v = e.target.value;
    setRpValue(v);
    const num = Number(v) || 0;
    if (hargaBeli > 0) {
      const pct = Math.min(100, Math.max(0, (num / hargaBeli) * 100));
      onPatch({ diskon_persen: Math.round(pct * 100) / 100 });
    }
  };

  return (
    <label className="flex-1 min-w-[120px]">
      <span className="mb-0.5 block text-[11px] font-medium text-slate-500">
        Diskon
      </span>
      <div className="flex items-stretch gap-0">
        <input
          type="number"
          min="0"
          max={mode === "persen" ? 100 : undefined}
          step={mode === "persen" ? 1 : 100}
          value={mode === "persen" ? (diskonPersen || "") : rpValue}
          onChange={mode === "persen" ? onPersenChange : onRupiahChange}
          placeholder={mode === "persen" ? "0" : "0"}
          className={`w-full rounded-l-lg border border-r-0 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-brand-500 ${
            fieldClass || "border-slate-300"
          }`}
        />
        <button
          type="button"
          onClick={toggleMode}
          className="shrink-0 rounded-r-lg border border-slate-300 bg-slate-100 px-2 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
          title={mode === "persen" ? "Klik untuk input nominal Rp" : "Klik untuk input persen %"}
        >
          {mode === "persen" ? "%" : "Rp"}
        </button>
      </div>
    </label>
  );
}

// Komponen: satu baris item pada tabel validasi
function kodeSimilarity(a, b) {
  const na = (a || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const nb = (b || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const maxLen = Math.max(na.length, nb.length);
  const dp = Array.from({ length: na.length + 1 }, () => Array(nb.length + 1).fill(0));
  for (let i = 0; i <= na.length; i++) dp[i][0] = i;
  for (let j = 0; j <= nb.length; j++) dp[0][j] = j;
  for (let i = 1; i <= na.length; i++)
    for (let j = 1; j <= nb.length; j++)
      dp[i][j] = na[i - 1] === nb[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return 1 - dp[na.length][nb.length] / maxLen;
}

function ItemRow({
  index,
  row,
  isHandwritten,
  onPatch,
  onRemove,
  onDecisionChange,
}) {
  const [autoFillMsg, setAutoFillMsg] = useState("");
  const debounceRef = useRef(null);
  const onPatchRef = useRef(onPatch);
  const onDecisionRef = useRef(onDecisionChange);
  onPatchRef.current = onPatch;
  onDecisionRef.current = onDecisionChange;

  // Lookup kode ke database — dipakai oleh debounce (onChange) dan Enter (scanner)
  async function lookupKode(trimmed) {
    if (!trimmed || trimmed.length < 3) return;
    try {
      const res = await productsApi.list({ q: trimmed, limit: 5 });
      const products = res?.data || [];
      const norm = (k) => (k || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

      const exact = products.find((p) => norm(p.kode_barang) === norm(trimmed));
      if (exact) {
        onPatchRef.current({
          nama_barang: exact.nama_barang || "",
          harga_beli: exact.harga_beli ?? 0,
          harga_jual: exact.harga_jual ?? 0,
          merk: exact.merk || "",
          candidates: [{ product_id: exact.id, kode_barang: exact.kode_barang, nama_barang: exact.nama_barang, merk: exact.merk, similarity: 1.0 }],
        });
        onDecisionRef.current(`cand:${exact.id}`);
        setAutoFillMsg(`Kode cocok 100% — data terisi dari "${exact.nama_barang}"`);
        return;
      }

      const withSim = products.map((p) => ({
        product_id: p.id,
        kode_barang: p.kode_barang,
        nama_barang: p.nama_barang,
        merk: p.merk,
        similarity: kodeSimilarity(trimmed, p.kode_barang),
      }));
      const highMatches = withSim.filter((c) => c.similarity >= 0.8);

      if (highMatches.length > 0) {
        onPatchRef.current({ candidates: highMatches, action: null, product_id: null, picked_label: "" });
      } else {
        onPatchRef.current({ candidates: [], action: "new", product_id: null, picked_label: "" });
      }
    } catch {
      // gagal fetch — diam saja
    }
  }

  function handleKodeChange(e) {
    const val = e.target.value;
    onPatch({ kode_barang: val });
    setAutoFillMsg("");

    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = val.trim();
    if (!trimmed || trimmed.length < 3) {
      onPatchRef.current({ candidates: [], action: null, product_id: null, picked_label: "" });
      return;
    }
    debounceRef.current = setTimeout(() => lookupKode(trimmed), 500);
  }

  // Enter dari barcode scanner → langsung lookup tanpa tunggu debounce
  function handleKodeKeyDown(e) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    lookupKode(row.kode_barang.trim());
  }

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

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

  let decisionValue = "";
  if (row.action === "new") decisionValue = "new";
  else if (row.action === "restock" && row.product_id)
    decisionValue = `cand:${row.product_id}`;

  const highCandidates = row.candidates.filter((c) => c.similarity >= 0.8);
  const candidateInList = highCandidates.some(
    (c) => c.product_id === row.product_id
  );
  const showHighMatchAlert = highCandidates.length > 0 && !row.action;

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
          Delete Row
        </button>
      </div>

      {/* Alert kesamaan tinggi (>= 80% tapi bukan 100%) */}
      {showHighMatchAlert && (
        <div className="mb-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2">
          <p className="text-xs font-semibold text-amber-800">
            Ditemukan produk dengan kesamaan cukup tinggi — silakan periksa dropdown di bawah.
          </p>
          <p className="mt-0.5 text-[11px] text-amber-700">
            {highCandidates.map((c) => `${c.kode_barang} — ${c.nama_barang} (${persen(c.similarity)})`).join("; ")}
          </p>
        </div>
      )}

      {/* Keputusan produk */}
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">
          {highCandidates.length > 0 ? "Cocokkan ke produk yang ada" : "Pilih tindakan"}
        </span>
        <select
          value={decisionValue}
          onChange={(e) => onDecisionChange(e.target.value)}
          className={`w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500 ${
            showHighMatchAlert ? "border-amber-400" : "border-slate-300"
          }`}
        >
          <option value="">— Pilih tindakan —</option>
          {row.action === "restock" && !candidateInList && row.product_id && (
            <option value={`cand:${row.product_id}`}>
              {row.picked_label} (dipilih)
            </option>
          )}
          {highCandidates.map((c) => (
            <option key={c.product_id} value={`cand:${c.product_id}`}>
              {c.nama_barang} — {c.kode_barang} ({persen(c.similarity)})
            </option>
          ))}
          <option value="new">+ Buat produk baru</option>
          <option value="search">Cari produk lain di master barang...</option>
        </select>
      </label>

      {row.action === "restock" && row.picked_label && (
        <p className="mt-1 text-xs text-emerald-600">
          Restock: {row.picked_label}
        </p>
      )}
      {row.action === "new" && (
        <p className="mt-1 text-xs text-blue-600">
          Produk baru akan dibuat dari kode &amp; nama di bawah.
        </p>
      )}

      {/* Field editable */}
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">
            Kode Barang{row.action !== "restock" && <span className="ml-0.5 text-red-500">*</span>}
          </span>
          <input
            value={row.kode_barang}
            onChange={handleKodeChange}
            onKeyDown={handleKodeKeyDown}
            placeholder="Ketik / scan barcode → Enter"
            className={`w-full rounded-lg border px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-brand-500 ${
              fieldClass("kode_barang") || "border-slate-300"
            }`}
          />
          {autoFillMsg && (
            <span className="mt-0.5 block text-[10px] font-medium text-emerald-600">{autoFillMsg}</span>
          )}
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">
            Nama Barang{row.action !== "restock" && <span className="ml-0.5 text-red-500">*</span>}
          </span>
          <input
            value={row.nama_barang}
            onChange={(e) => onPatch({ nama_barang: e.target.value })}
            className={`w-full rounded-lg border px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-brand-500 ${
              fieldClass("nama_barang") || "border-slate-300"
            }`}
          />
        </label>
        {/* Merk — wajib untuk produk baru, readonly untuk restock */}
        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">
            Merk{row.action === "new" && <span className="ml-0.5 text-red-500">*</span>}
          </span>
          <input
            value={row.merk || ""}
            onChange={(e) => onPatch({ merk: e.target.value })}
            placeholder={row.action === "restock" ? "—" : "mis. Aspira"}
            disabled={row.action === "restock"}
            className={`w-full rounded-lg border px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-brand-500 ${
              row.action === "restock"
                ? "border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed"
                : fieldClass("merk") || "border-slate-300"
            }`}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">
            Qty <span className="ml-0.5 text-red-500">*</span>
          </span>
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
            Harga Beli <span className="ml-0.5 text-red-500">*</span>
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
            Harga Jual
          </span>
          <input
            type="number"
            min="0"
            value={row.harga_jual || ""}
            onChange={(e) => onPatch({ harga_jual: e.target.value })}
            placeholder="0"
            className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-brand-500"
          />
        </label>
      </div>
      {/* Subtotal per item */}
      {Number(row.harga_beli) > 0 && Number(row.qty) > 0 && (
        <div className="mt-1.5 flex items-center justify-between text-xs text-slate-500">
          <span>
            Subtotal: {row.qty} × {rupiah(Number(row.harga_beli))}
          </span>
          <span className="font-semibold text-slate-700">
            {rupiah(Number(row.qty) * Number(row.harga_beli))}
          </span>
        </div>
      )}

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

// Komponen: panel daftar Draft (Cross-device Resume)
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
            Nota yang sudah di draft sementara, buka di sini untuk diedit kembali &amp;
            dikonfirmasi untuk disimpan.
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={onRefresh}>
          ↻ Reload
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
                    Delete
                  </button>
                  <button
                    onClick={() => onOpen(d.id)}
                    className="rounded-md bg-brand-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-brand-700"
                  >
                    Continue →
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
