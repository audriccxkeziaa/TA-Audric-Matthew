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
  rowErrors,
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
  const [supplierAddress, setSupplierAddress] = useState("");
  const [supplierList, setSupplierList] = useState([]); // daftar nama (untuk combobox)
  const [supplierAddrMap, setSupplierAddrMap] = useState({}); // nama(lower) → alamat terbaru
  const [notaTypeChoice, setNotaTypeChoice] = useState("auto"); // auto|cetak|tulisan_tangan
  const [dragOver, setDragOver] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false); // overlay kamera in-app (getUserMedia)

  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocr, setOcr] = useState(null); // hasil mentah response.data
  const [ambiguous, setAmbiguous] = useState(null);
  const [rows, setRows] = useState([]);
  const [committing, setCommitting] = useState(false);
  const [showErrors, setShowErrors] = useState(false); // tampilkan tanda merah setelah Save ditekan
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
    purchasesApi
      .suppliers()
      .then((res) => {
        // Backend kini mengembalikan [{ name, address }] (alamat terbaru per supplier).
        const arr = res?.data || [];
        setSupplierList(arr.map((s) => s.name).filter(Boolean));
        const map = {};
        for (const s of arr) {
          if (s?.name) map[s.name.toLowerCase()] = s.address || "";
        }
        setSupplierAddrMap(map);
      })
      .catch(() => {});
  }, []);

  // Saat nama supplier dipilih/diketik: bila cocok supplier dikenal, autofill alamat
  // TERBARU (tetap bisa diedit). Tidak menimpa bila supplier belum dikenal.
  function onSupplierNameChange(name) {
    setSupplierName(name);
    const key = (name || "").trim().toLowerCase();
    if (key && Object.prototype.hasOwnProperty.call(supplierAddrMap, key)) {
      setSupplierAddress(supplierAddrMap[key] || "");
    }
  }

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

  // Frame hasil kamera in-app (getUserMedia) → perlakukan sama seperti file biasa,
  // lalu masuk pipeline OCR (Tesseract → Groq Vision) saat user tekan Process OCR.
  function onCameraCapture(f) {
    pickFile(f);
    setCameraOpen(false);
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
    // Draft didukung untuk OCR maupun MANUAL. Minimal ada supplier/no.nota/item.
    const hasContent =
      ocr?.file_nota_url || supplierName.trim() || noNota.trim() || rows.length > 0;
    if (!hasContent) {
      toast.error("Belum ada yang bisa disimpan — isi supplier atau minimal satu item.");
      return;
    }
    setSavingDraft(true);
    try {
      const res = await purchasesApi.drafts.save({
        id: currentDraftId,
        no_nota_supplier: noNota.trim() || ocr?.no_nota_supplier || null,
        supplier_name: supplierName.trim() || null,
        supplier_address: supplierAddress.trim() || null,
        file_nota_url: ocr?.file_nota_url || null,
        nota_type: ocr?.nota_type || null,
        input_mode: inputMode || (ocr?.file_nota_url ? "ocr" : "manual"),
        raw_text: ocr?.raw_text || null,
        preprocessing: ocr?.preprocessing || null,
        quality: ocr?.quality || null,
        items: rows.map(rowToDraftItem),
        status: "draft",
        // Diskon level-nota (opsional) — ikut disimpan agar tidak hilang saat resume.
        diskon_persen: Number(diskonPersen) || 0,
        potongan_harga: Number(potonganHarga) || 0,
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
      // Pulihkan mode (OCR/manual) agar form supplier & preview tampil benar saat
      // resume lintas perangkat — tanpa ini, draft OCR yang dibuka di laptop kehilangan
      // konteks supplier dan tak bisa disimpan.
      const mode = d.input_mode || (d.file_nota_url ? "ocr" : "manual");
      setInputMode(mode);
      // Hanya simpan blok OCR bila memang mode OCR (ada file/raw_text).
      if (mode === "ocr" || d.file_nota_url) {
        setOcr({
          no_nota_supplier: d.no_nota_supplier,
          file_nota_url: d.file_nota_url,
          file_nota_signed_url: d.file_nota_signed_url,
          nota_type: d.nota_type,
          raw_text: d.raw_text,
          preprocessing: d.preprocessing,
          quality: d.quality,
        });
      } else {
        setOcr(null);
      }
      setNoNota(d.no_nota_supplier || "");
      setSupplierName(d.supplier_name || "");
      setSupplierAddress(d.supplier_address || "");
      // Pulihkan diskon level-nota (0/null → kosong agar placeholder '0' tampil).
      setDiskonPersen(Number(d.diskon_persen) ? String(Number(d.diskon_persen)) : "");
      setPotonganHarga(Number(d.potongan_harga) ? String(Number(d.potongan_harga)) : "");
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
    // Carry-over merk: begitu user mengetik merk baru di satu baris, daftarkan ke
    // merkList agar baris berikutnya tinggal memilih (tak perlu ketik ulang).
    if (typeof patch.merk === "string") {
      const m = patch.merk.trim();
      if (m) {
        setMerkList((list) =>
          list.some((x) => x.toLowerCase() === m.toLowerCase())
            ? list
            : [...list, m].sort((a, b) => a.localeCompare(b, "id"))
        );
      }
    }
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
        // Baris OCR: pertahankan harga beli dari nota (harga transaksi ini);
        // selain itu pakai harga master. Harga jual selalu autofill dari master.
        harga_beli: row.source === "ocr" && Number(row.harga_beli) > 0
          ? row.harga_beli
          : (c?.harga_beli ?? row.harga_beli ?? 0),
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
  // Menghasilkan rincian error (header + per-baris) + id field PERTAMA yang salah
  // (untuk diarahkan & di-fokus). Tombol Save TIDAK lagi di-disable — saat ditekan
  // dan ada error, kolom yang kurang ditandai merah lalu layar diarahkan ke sana.
  const validation = useMemo(() => {
    const header = {
      supplierName: !supplierName.trim() ? "Nama Supplier wajib diisi." : null,
      noNota: !noNota.trim() ? "No. Nota Supplier wajib diisi." : null,
      empty: rows.length === 0 ? "Tambahkan minimal satu item barang." : null,
    };

    const rowErrs = {}; // uid -> { field: pesan }
    for (const r of rows) {
      const er = rowErrors(r, { isHandwritten });
      if (Object.keys(er).length) rowErrs[r.uid] = er;
    }

    // Field pertama yang bermasalah (urutan visual: header dulu, lalu baris atas→bawah).
    let firstId = null;
    let firstMsg = null;
    if (header.supplierName) { firstId = "sm-field-supplierName"; firstMsg = header.supplierName; }
    else if (header.noNota) { firstId = "sm-field-noNota"; firstMsg = header.noNota; }
    else if (header.empty) { firstId = null; firstMsg = header.empty; }
    else {
      for (const r of rows) {
        const er = rowErrs[r.uid];
        if (er) {
          const field = Object.keys(er)[0];
          firstId = `sm-row-${r.uid}-${field}`;
          firstMsg = er[field];
          break;
        }
      }
    }

    const count =
      (header.supplierName ? 1 : 0) +
      (header.noNota ? 1 : 0) +
      (header.empty ? 1 : 0) +
      Object.values(rowErrs).reduce((s, er) => s + Object.keys(er).length, 0);

    return { header, rowErrs, firstId, firstMsg, count, ok: count === 0 };
  }, [rows, noNota, supplierName, isHandwritten]);

  const canCommit = validation.ok;

  // Arahkan (scroll) + fokus ke kolom wajib pertama yang belum benar.
  function focusFirstError(id) {
    if (!id || typeof document === "undefined") return;
    requestAnimationFrame(() => {
      const el = document.getElementById(id);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      if (typeof el.focus === "function") {
        try { el.focus({ preventScroll: true }); } catch { el.focus(); }
      }
    });
  }

  // ---------- Hitung subtotal & diskon (mirror perhitungan fn_commit_purchase) ----------
  // Subtotal kotor: sebelum diskon apa pun (Σ qty × harga_beli).
  const subtotalKotor = useMemo(
    () => rows.reduce((s, r) => s + (Number(r.qty) || 0) * (Number(r.harga_beli) || 0), 0),
    [rows]
  );
  // Total potongan dari diskon per item (diskon % + potongan Rp/unit × qty).
  const diskonItemNilai = useMemo(
    () =>
      rows.reduce((s, r) => {
        const qty = Number(r.qty) || 0;
        const gross = qty * (Number(r.harga_beli) || 0);
        const pct = Math.min(Math.max(Number(r.diskon_persen) || 0, 0), 100);
        const nominal = Math.max(Number(r.diskon_nominal) || 0, 0);
        return s + Math.round(gross * pct / 100 + nominal * qty);
      }, 0),
    [rows]
  );
  // Subtotal setelah diskon per item — basis untuk diskon nota (sama seperti DB).
  const subtotalSetelahItem = Math.max(subtotalKotor - diskonItemNilai, 0);
  const diskonNotaNilai = useMemo(() => {
    const pct = Math.min(Number(diskonPersen) || 0, 100);
    const pot = Number(potonganHarga) || 0;
    return Math.round(subtotalSetelahItem * pct / 100) + pot;
  }, [diskonPersen, potonganHarga, subtotalSetelahItem]);
  const grandTotal = Math.max(subtotalSetelahItem - diskonNotaNilai, 0);

  // ---------- Commit (R2) ----------
  async function commit() {
    // Save selalu bisa ditekan. Bila ada kolom wajib yang belum benar, tandai
    // merah & arahkan layar ke kolom pertama yang bermasalah (bukan men-disable).
    if (!validation.ok) {
      setShowErrors(true);
      focusFirstError(validation.firstId);
      toast.error(
        validation.count > 1
          ? `${validation.count} kolom belum lengkap. ${validation.firstMsg}`
          : validation.firstMsg
      );
      return;
    }
    setCommitting(true);
    try {
      const items = rows.map((r) => {
        const base = {
          qty: parseInt(r.qty, 10) || 0,
          harga_beli: Number(r.harga_beli) || 0,
          // Diskon per barang (opsional, default 0). % di-clamp 0–100; Rp/unit ≥ 0.
          diskon_persen: Math.min(Math.max(Number(r.diskon_persen) || 0, 0), 100),
          diskon_nominal: Math.max(Number(r.diskon_nominal) || 0, 0),
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
          // Kode barang TIDAK disinkron dari stok masuk — hanya diedit manual di
          // master barang oleh admin (mencegah perubahan kode tak sengaja saat input).
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
        no_nota_supplier: noNota.trim() || ocr?.no_nota_supplier || null,
        supplier_name: supplierName.trim() || null,
        supplier_address: supplierAddress.trim() || null,
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
    setSupplierAddress("");
    setNotaTypeChoice("auto");
    setOcr(null);
    setAmbiguous(null);
    setRows([]);
    setShowErrors(false);
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
      // Snapshot data master agar perubahan field terdeteksi & ikut update master
      // barang saat commit (tanpa ini, edit via "cari di master" tidak tersimpan).
      _orig_product: {
        kode_barang: p.kode_barang,
        nama_barang: p.nama_barang,
        merk: p.merk || "",
        harga_beli: p.harga_beli ?? 0,
        harga_jual: p.harga_jual ?? 0,
      },
    });
  }

  return {
    // refs
    fileInputRef, cameraInputRef, rowsContainerRef,
    // device & step
    isMobile, step, inputMode, setInputMode,
    // upload
    file, previewUrl, noNota, setNoNota,
    supplierName, setSupplierName: onSupplierNameChange, supplierList,
    supplierAddress, setSupplierAddress,
    notaTypeChoice, setNotaTypeChoice,
    dragOver, setDragOver, pickFile, onDrop,
    cameraOpen, setCameraOpen, onCameraCapture,
    ocrLoading, runOcr, startManualInput, goBackToModeSelect,
    // ocr result
    ocr, ambiguous, setAmbiguous, notaType, isHandwritten,
    // rows
    rows, merkList, patchRow, removeRow, addManualRow, onDecisionChange,
    pickerRowUid, setPickerRowUid, pickProductForRow,
    // totals
    subtotalKotor, diskonItemNilai, subtotalSetelahItem,
    diskonPersen, setDiskonPersen, potonganHarga, setPotonganHarga,
    diskonNotaNilai, grandTotal, canCommit,
    showErrors, validation,
    // drafts
    drafts, draftsLoading, refreshDrafts, saveDraft, savingDraft,
    loadDraft, removeDraft, currentDraftId, draftSavedInfo,
    confirmDelete, setConfirmDelete,
    // commit
    commit, committing, done, resetAll,
  };
}
