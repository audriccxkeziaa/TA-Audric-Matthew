"use client";
// features/stok-masuk/hooks/useStokMasuk.js — seluruh logika alur stok masuk:
// upload + OCR, validasi baris, draft (cross-device resume), commit (R2),
// serta deteksi perangkat & proteksi unsaved. Logika dipindahkan apa adanya
// dari page.jsx — tidak ada perubahan aturan/endpoint.

import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { purchasesApi, productsApi } from "@/lib/api";
import { useToast } from "@/hooks/useToast";
import {
  ocrItemToRow,
  blankManualRow,
  rowToDraftItem,
  draftItemToRow,
} from "../lib/rows";

export function useStokMasuk() {
  const toast = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const rowsContainerRef = useRef(null);

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
  const [supplierName, setSupplierName] = useState("");
  const [supplierList, setSupplierList] = useState([]);
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

  // --- Draft state (Cross-device Resume) ---
  const [drafts, setDrafts] = useState([]);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [currentDraftId, setCurrentDraftId] = useState(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftSavedInfo, setDraftSavedInfo] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [merkList, setMerkList] = useState([]);

  useEffect(() => {
    productsApi.merks().then((res) => setMerkList(res?.data || [])).catch(() => {});
    purchasesApi.suppliers().then((res) => setSupplierList(res?.data || [])).catch(() => {});
  }, []);

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
        supplier_name: supplierName.trim() || null,
        file_nota_url: ocr.file_nota_url,
        nota_type: ocr?.nota_type || null,
        raw_text: ocr?.raw_text || null,
        preprocessing: ocr?.preprocessing || null,
        quality: ocr?.quality || null,
        items: rows.map(rowToDraftItem),
        status: "draft",
      });
      setCurrentDraftId(res.data?.id || null);
      setDraftSavedInfo({ when: new Date(), count: rows.length });
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
      setSupplierName(d.supplier_name || "");
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
      toast.success("Draft berhasil dihapus.");
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
    setTimeout(() => {
      rowsContainerRef.current?.scrollTo({
        top: rowsContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
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
        kode_barang: c?.kode_barang || row.kode_barang || "",
        nama_barang: c?.nama_barang || row.nama_barang || "",
        merk: c?.merk || row.merk || "",
        harga_beli: c?.harga_beli ?? row.harga_beli ?? 0,
        harga_jual: c?.harga_jual ?? row.harga_jual ?? 0,
        _orig_product: c ? {
          kode_barang: c.kode_barang,
          nama_barang: c.nama_barang,
          merk: c.merk || "",
          harga_beli: c.harga_beli ?? 0,
          harga_jual: c.harga_jual ?? 0,
        } : row._orig_product || null,
      });
    }
  }

  // ---------- Validasi siap commit (R2 sisi klien) ----------
  const canCommit = useMemo(() => {
    if (rows.length === 0) return false;
    if (!noNota.trim()) return false;
    if (!supplierName.trim()) return false;
    return rows.every((r) => {
      const qtyOk = Number(r.qty) > 0;
      const hargaOk = Number(r.harga_beli) > 0;
      if (!qtyOk || !hargaOk) return false;
      if (!r.merk?.trim()) return false;
      // Kode dan nama wajib untuk semua jenis item (new maupun restock)
      if (!r.kode_barang.trim() || !r.nama_barang.trim()) return false;
      if (r.action === "restock") {
        if (!r.product_id) return false;
      } else if (r.action !== "new") {
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
    if (!noNota.trim()) { toast.error("No. Nota Supplier wajib diisi"); return; }
    if (!supplierName.trim()) { toast.error("Nama Supplier wajib diisi"); return; }
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
        // Restock: deteksi perubahan field vs data asli produk untuk update master barang
        const restockObj = { ...base, action: "restock", product_id: r.product_id };
        if (r._orig_product && r.product_id) {
          const orig = r._orig_product;
          const updates = {};
          if (r.kode_barang.trim() && r.kode_barang.trim() !== orig.kode_barang)
            updates.kode_barang = r.kode_barang.trim();
          if (r.nama_barang.trim() && r.nama_barang.trim() !== orig.nama_barang)
            updates.nama_barang = r.nama_barang.trim();
          const currMerk = (r.merk || "").trim();
          const origMerk = (orig.merk || "").trim();
          if (currMerk !== origMerk) updates.merk = currMerk || null;
          if (Number(r.harga_beli) !== Number(orig.harga_beli))
            updates.harga_beli = Number(r.harga_beli);
          // harga_jual: bandingkan jika ada data asli, atau tambahkan jika user set nilai
          if (orig.harga_jual != null && Number(r.harga_jual) !== Number(orig.harga_jual))
            updates.harga_jual = Number(r.harga_jual);
          else if (orig.harga_jual == null && Number(r.harga_jual) > 0)
            updates.harga_jual = Number(r.harga_jual);
          if (Object.keys(updates).length > 0) restockObj.product_updates = updates;
        }
        return restockObj;
      });

      const res = await purchasesApi.commit({
        no_nota_supplier: ocr?.no_nota_supplier || noNota.trim() || null,
        supplier_name: supplierName.trim() || null,
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
      toast.error((e.rule ? `[${e.rule}] ` : "") + (e.message || "Gagal menyimpan"));
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
    setSupplierName("");
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

  // Dipakai ProductPicker saat user mencari produk lain untuk satu baris.
  function pickProductForRow(p) {
    patchRow(pickerRowUid, {
      action: "restock",
      product_id: p.id,
      picked_label: p.nama_barang,
      kode_barang: p.kode_barang || "",
      nama_barang: p.nama_barang || "",
      merk: p.merk || "",
      harga_beli: p.harga_beli ?? 0,
      harga_jual: p.harga_jual ?? 0,
    });
  }

  return {
    // refs
    fileInputRef, cameraInputRef, rowsContainerRef,
    // device & step
    isMobile, step, inputMode, setInputMode,
    // upload
    file, previewUrl, noNota, setNoNota,
    supplierName, setSupplierName, supplierList,
    notaTypeChoice, setNotaTypeChoice,
    dragOver, setDragOver, pickFile, onDrop,
    ocrLoading, runOcr, startManualInput, goBackToModeSelect,
    // ocr result
    ocr, ambiguous, setAmbiguous, notaType, isHandwritten,
    // rows
    rows, merkList, patchRow, removeRow, addManualRow, onDecisionChange,
    pickerRowUid, setPickerRowUid, pickProductForRow,
    // totals
    subtotalBarang, diskonPersen, setDiskonPersen,
    potonganHarga, setPotonganHarga, grandTotal, canCommit,
    // drafts
    drafts, draftsLoading, refreshDrafts, saveDraft, savingDraft,
    loadDraft, removeDraft, currentDraftId, draftSavedInfo,
    confirmDelete, setConfirmDelete,
    // commit
    commit, committing, done, resetAll,
  };
}
