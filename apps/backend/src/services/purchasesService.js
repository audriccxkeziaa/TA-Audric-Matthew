// purchasesService.js — Orkestrator OCR + Validasi + Commit Pembelian
//
// Dua jalur pemrosesan: nota cetak (sharp + tesseract) dan
// tulisan tangan (opencv fallback). Strategi mitigasi:
//   1. Klasifikasi awal jenis nota (cetak / tulisan_tangan / ambigu)
//   2. Pipeline preprocessing bersyarat (sharp vs opencv)
//   3. Ambang confidence berbeda per jenis nota
//   4. Fallback ke input manual jika kualitas terlalu rendah

const ocrService = require("./ocrService");
const notaClassifier = require("./notaClassifierService");
const stringMatcher = require("./stringMatchingService");
const pdfService = require("./pdfService");
const ruleEngine = require("./ruleEngine");
const purchaseRepository = require("../repositories/purchaseRepository");
const productRepository = require("../repositories/productRepository");
const stockLogRepository = require("../repositories/stockLogRepository");

// Strategi 4 — ambang fallback (untuk jalur tulisan tangan).
const STRAT4_EMPTY_FIELD_PCT = 0.4; // > 40% field kosong → fallback
const STRAT4_AVG_CONFIDENCE_MIN = 30; // avg confidence < 30 → fallback

// Hitung statistik untuk Strategi 4: persentase field kosong & avg confidence keseluruhan.
function computeOcrQualityStats(items) {
  if (!items || items.length === 0) {
    return { empty_pct: 1, avg_confidence: 0, total_fields: 0 };
  }
  const FIELDS = ["kode_barang", "nama_barang", "qty", "harga_beli"];
  let totalFields = 0;
  let emptyFields = 0;
  let confSum = 0;
  let confCount = 0;
  for (const it of items) {
    for (const f of FIELDS) {
      totalFields++;
      const v = it.raw?.[f];
      if (v === undefined || v === null || v === "" || v === 0) emptyFields++;
      const c = it.confidence?.[f];
      if (typeof c === "number" && c > 0) {
        confSum += c;
        confCount++;
      }
    }
  }
  return {
    empty_pct: totalFields > 0 ? emptyFields / totalFields : 1,
    avg_confidence: confCount > 0 ? confSum / confCount : 0,
    total_fields: totalFields,
  };
}

// Validasi nilai nota_type yang diterima dari client/auto-classify.
function normalizeNotaType(t) {
  if (t === "cetak" || t === "tulisan_tangan") return t;
  return null;
}

// ---------- /api/purchases/ocr ----------
// Body field: file (multipart) + opsional no_nota_supplier + opsional nota_type.
// nota_type: 'cetak' | 'tulisan_tangan' | undefined → auto-classify.
async function processOcr({ user, file, noNotaSupplier, notaType }) {
  if (!file || !file.buffer) {
    const e = new Error("File nota wajib diunggah");
    e.status = 400;
    throw e;
  }

  // (a) Simpan file ke Supabase Storage. File tetap disimpan walau OCR
  // nantinya gagal/fallback — penting untuk audit (Strategi 4).
  // NON-FATAL: kalau upload arsip gagal (mis. bucket menolak mimetype/size),
  // OCR TETAP lanjut tanpa arsip file — jangan jatuhkan seluruh proses ke 500.
  // (Arsip bisa dilengkapi setelah bucket dikonfigurasi; lihat migrasi 039.)
  let filePath = null;
  let signedUrl = null;
  try {
    filePath = await purchaseRepository.uploadNota({
      userId: user.id,
      originalName: file.originalname,
      mimetype: file.mimetype,
      buffer: file.buffer,
    });
    signedUrl = await purchaseRepository.createNotaSignedUrl(filePath);
  } catch (upErr) {
    console.error(
      `[POS-OCR] Upload arsip nota gagal (mimetype=${file.mimetype}) → lanjut OCR tanpa arsip:`,
      upErr.message
    );
  }

  // (b1) JALUR PDF — kalau mimetype application/pdf, coba ekstrak text-layer
  // langsung dulu (akurasi ~100% kalau PDF "lahir digital"). Kalau text-layer
  // kosong (PDF scan), render halaman 1 jadi PNG dan lanjutkan ke pipeline
  // OCR gambar yang sudah ada.
  let workingBuffer = file.buffer;
  let pdfMeta = null;
  if (file.mimetype === "application/pdf") {
    try {
      const extracted = await pdfService.extractPdfText(file.buffer);
      console.log(
        `[POS-OCR] PDF detected: ${extracted.pageCount} pages, ${extracted.alphanumCount} alphanumeric chars, isDigital=${extracted.isDigital}`
      );
      if (extracted.isDigital) {
        // Baseline: parser regex pada text-layer (tanpa Tesseract).
        const fakeData = { text: extracted.text, lines: [], confidence: 99 };
        let items = ocrService.validateAndFlagItems(
          ocrService.flagLowConfidence(
            ocrService.parseTesseractData(fakeData),
            60
          )
        );
        // Tingkatkan dengan Groq (teks → JSON terstruktur), seperti jalur gambar.
        // Bila Groq gagal / tidak ada API key → tetap pakai hasil regex baseline.
        let pdfPipeline = "pdf/text-layer-extract";
        const aiPdfItems = await ocrService.parseWithGroqText(
          extracted.text,
          items.length
        );
        if (aiPdfItems && aiPdfItems.length > 0) {
          items = ocrService.validateAndFlagItems(aiPdfItems);
          pdfPipeline += " + GroqText";
          console.log(
            `[POS-OCR] PDF text-layer ditingkatkan Groq → ${items.length} item`
          );
        }
        // Levenshtein matching
        const catalog = await purchaseRepository.listActiveProductsForMatching();
        const itemsWithCandidates = items.map((item, idx) => ({
          index: idx,
          raw: item.raw,
          confidence: item.confidence,
          confidence_avg: item.confidence_avg,
          low_confidence: item.low_confidence,
          needs_review: item.needs_review || false,
          review_reasons: item.review_reasons || [],
          line_text: item.line_text,
          transaction_index: item.transaction_index,
          transaction_code: item.transaction_code,
          candidates: stringMatcher.findTopCandidates({
            ocrName: item.raw.nama_barang,
            ocrKode: item.raw.kode_barang,
            products: catalog,
            topN: 3,
          }),
        }));
        const quality = computeOcrQualityStats(items);
        console.log(
          `[POS-OCR] User=${user.username} PDF text-layer → ${itemsWithCandidates.length} item (avg_conf=${quality.avg_confidence.toFixed(1)})`
        );
        return {
          status: "unsaved",
          file_nota_url: filePath,
          file_nota_signed_url: signedUrl,
          no_nota_supplier: noNotaSupplier || null,
          nota_type: "cetak", // PDF digital diperlakukan setara cetak
          classification: null,
          raw_text: extracted.text,
          preprocessing: {
            pipeline: pdfPipeline,
            page_count: extracted.pageCount,
            alphanum_chars: extracted.alphanumCount,
          },
          quality,
          items: itemsWithCandidates,
        };
      }
      // Text layer kosong → fallback render halaman 1 ke PNG
      try {
        const pngBuffer = await pdfService.renderPdfFirstPagePng(file.buffer);
        workingBuffer = pngBuffer;
        pdfMeta = {
          fallback_to_image: true,
          page_count: extracted.pageCount,
        };
        console.log("[POS-OCR] PDF text-layer kosong → render halaman 1 ke PNG, lanjut OCR gambar");
      } catch (renderErr) {
        console.warn("[POS-OCR] Gagal render PDF ke PNG:", renderErr.message);
        return {
          status: "manual_input_required",
          file_nota_url: filePath,
          file_nota_signed_url: signedUrl,
          no_nota_supplier: noNotaSupplier || null,
          nota_type: "cetak",
          classification: null,
          reason:
            "PDF tidak punya text-layer dan rendering ke gambar gagal. Silakan input manual.",
          items: [],
        };
      }
    } catch (err) {
      console.warn("[POS-OCR] PDF extract error:", err.message);
      return {
        status: "manual_input_required",
        file_nota_url: filePath,
        file_nota_signed_url: signedUrl,
        no_nota_supplier: noNotaSupplier || null,
        nota_type: "cetak",
        classification: null,
        reason: "Gagal membaca PDF. Silakan input manual atau upload format JPG/PNG.",
        items: [],
      };
    }
  }

  // (b) STRATEGI 1 — klasifikasi awal jika user belum override.
  let resolvedType = normalizeNotaType(notaType);
  let classification = null;
  if (!resolvedType) {
    try {
      classification = await notaClassifier.classifyNota(workingBuffer);
    } catch (err) {
      console.warn("[POS-OCR] classifier error:", err.message);
      classification = { type: "ambigu", features: { error: err.message } };
    }

    if (classification.type === "ambigu") {
      // Stop di sini — frontend akan tampilkan radio button untuk konfirmasi.
      console.log(
        `[POS-OCR] User=${user.username} klasifikasi=AMBIGU → minta konfirmasi user`
      );
      return {
        status: "ambiguous_classification",
        file_nota_url: filePath,
        file_nota_signed_url: signedUrl,
        no_nota_supplier: noNotaSupplier || null,
        classification,
        message:
          "Sistem tidak yakin jenis nota ini. Mohon pilih: cetak komputer atau tulisan tangan.",
      };
    }
    resolvedType = classification.type;
  }

  // (c) STRATEGI 2 — pipeline bersyarat
  let ocrResult;
  try {
    if (resolvedType === "tulisan_tangan") {
      ocrResult = await ocrService.recognizeHandwrittenReceipt(workingBuffer);
    } else {
      ocrResult = await ocrService.recognizePrintedReceipt(workingBuffer);
    }
    // Annotate hasil dengan info PDF kalau memang fallback dari PDF→PNG
    if (pdfMeta && ocrResult?.preprocessing) {
      ocrResult.preprocessing.from_pdf = pdfMeta;
    }
  } catch (err) {
    // OCV_NOT_AVAILABLE: opencv4nodejs belum ter-install / build gagal.
    // Sesuai semangat Strategi 4 → fallback ke input manual.
    if (err.code === "OCV_NOT_AVAILABLE" && resolvedType === "tulisan_tangan") {
      console.warn("[POS-OCR] opencv unavailable → fallback ke manual input");
      return {
        status: "manual_input_required",
        file_nota_url: filePath,
        file_nota_signed_url: signedUrl,
        no_nota_supplier: noNotaSupplier || null,
        nota_type: resolvedType,
        classification,
        reason:
          "Modul OCR tulisan tangan (opencv4nodejs) belum siap. Silakan input manual sementara.",
        items: [],
      };
    }
    console.error("[POS-OCR] recognize error:", err.message);
    const e = new Error("Gagal memproses OCR pada file nota");
    e.status = 500;
    throw e;
  }

  // (d) STRATEGI 4 — fallback agresif untuk tulisan tangan kualitas rendah
  const quality = computeOcrQualityStats(ocrResult.items);
  if (
    resolvedType === "tulisan_tangan" &&
    (quality.empty_pct > STRAT4_EMPTY_FIELD_PCT ||
      quality.avg_confidence < STRAT4_AVG_CONFIDENCE_MIN)
  ) {
    console.warn(
      `[POS-OCR] Strategi 4 fallback: empty_pct=${quality.empty_pct.toFixed(2)} avg_conf=${quality.avg_confidence.toFixed(1)}`
    );
    return {
      status: "manual_input_required",
      file_nota_url: filePath,
      file_nota_signed_url: signedUrl,
      no_nota_supplier: noNotaSupplier || null,
      nota_type: resolvedType,
      classification,
      preprocessing: ocrResult.preprocessing,
      raw_text: ocrResult.raw_text,
      quality,
      reason:
        "Kualitas hasil OCR terlalu rendah untuk divalidasi. Silakan input manual.",
      items: [], // dosen wajib input dari nol — tapi raw_text tetap dikirim untuk referensi
    };
  }

  // (e) Levenshtein matching: untuk tiap item OCR, cari top-3 candidate
  const catalog = await purchaseRepository.listActiveProductsForMatching();
  const itemsWithCandidates = ocrResult.items.map((item, idx) => ({
    index: idx,
    raw: item.raw,
    confidence: item.confidence,
    confidence_avg: item.confidence_avg,
    low_confidence: item.low_confidence,
    needs_review: item.needs_review || false,
    review_reasons: item.review_reasons || [],
    line_text: item.line_text,
    candidates: stringMatcher.findTopCandidates({
      ocrName: item.raw.nama_barang,
      ocrKode: item.raw.kode_barang,
      products: catalog,
      topN: 3,
    }),
  }));

  console.log(
    `[POS-OCR] User=${user.username} type=${resolvedType} processed nota=${noNotaSupplier || "(tanpa nomor)"} → ${itemsWithCandidates.length} item (avg_conf=${quality.avg_confidence.toFixed(1)}, empty=${(quality.empty_pct * 100).toFixed(0)}%)`
  );

  return {
    status: "unsaved",
    file_nota_url: filePath,
    file_nota_signed_url: signedUrl,
    no_nota_supplier: noNotaSupplier || null,
    nota_type: resolvedType,
    classification,
    raw_text: ocrResult.raw_text,
    preprocessing: ocrResult.preprocessing,
    quality,
    items: itemsWithCandidates,
  };
}

// ---------- /api/purchases/commit ----------
async function commitPurchase({ user, payload }) {
  const {
    no_nota_supplier,
    supplier_name,
    file_nota_url,
    status_validasi,
    items,
    diskon_persen,
    potongan_harga,
  } = payload || {};

  // R2 LAYER 1: validasi konfirmasi user + bentuk payload
  const r2 = ruleEngine.checkR2PurchaseValidation({ status_validasi, items });
  if (!r2.ok) {
    // Audit R2 REJECTED — stok belum berubah, tetap dicatat untuk forensik
    await stockLogRepository.write({
      product_id: null,
      user_id: user.id,
      source_type: "purchase",
      rule_triggered: "R2",
      rule_action: "REJECTED",
      reason_detail: r2.reason,
      context_payload: { payload },
    });
    const e = new Error(r2.reason);
    e.status = 400;
    e.rule = "R2";
    throw e;
  }

  // action='restock' → product_id, action='new' → kode_barang + nama_barang
  // product_updates: perubahan field master barang yang diinput user untuk restock items
  const productUpdatesList = [];
  const normalizedItems = items.map((it) => {
    const action = it.action === "new" ? "new" : "restock";
    const base = {
      action,
      qty: Number(it.qty),
      harga_beli: Number(it.harga_beli),
      diskon_persen: Number(it.diskon_persen ?? 0),
      source: it.source === "ocr" ? "ocr" : "manual",
    };
    if (action === "new") {
      base.kode_barang = String(it.kode_barang || "").trim();
      base.nama_barang = String(it.nama_barang || "").trim();
      if (it.merk) base.merk = String(it.merk).trim();
      if (it.harga_jual) base.harga_jual = Number(it.harga_jual);
    } else {
      base.product_id = it.product_id;
      if (it.product_updates && Object.keys(it.product_updates).length > 0) {
        productUpdatesList.push({
          product_id: it.product_id,
          updates: it.product_updates,
        });
      }
    }
    return base;
  });

  // RPC atomik: INSERT purchases + INSERT purchase_items.
  // Trigger R4 (fn_purchase_items_apply) menambah products.stok + tulis stock_logs ACCEPTED.
  let rpcResult;
  try {
    rpcResult = await purchaseRepository.commitPurchaseViaRpc({
      userId: user.id,
      noNotaSupplier: no_nota_supplier || null,
      supplierName: supplier_name?.trim() || null,
      fileNotaUrl: file_nota_url || null,
      items: normalizedItems,
      diskonPersen: Number(diskon_persen) || 0,
      potonganHarga: Number(potongan_harga) || 0,
    });
  } catch (err) {
    const mapped = ruleEngine.mapDbErrorToHttp(err);
    if (mapped.rule === "R3") {
      await stockLogRepository.write({
        product_id: null,
        user_id: user.id,
        source_type: "purchase",
        rule_triggered: "R3",
        rule_action: "TRIGGERED",
        reason_detail: mapped.message,
        context_payload: { payload },
      });
    }
    const e = new Error(mapped.message);
    e.status = mapped.status;
    e.rule = mapped.rule;
    throw e;
  }

  const detail = await purchaseRepository.getPurchaseDetail(rpcResult.purchase_id);
  detail.products_created = Number(rpcResult.products_created || 0);
  console.log(
    `[POS-PURCHASES] Commit purchase_id=${rpcResult.purchase_id} oleh user=${user.username} total=${rpcResult.total} (${normalizedItems.length} item, ${detail.products_created} produk baru)`
  );

  // Proses pembaruan master data produk untuk restock items yang diedit user
  if (productUpdatesList.length > 0) {
    await Promise.all(
      productUpdatesList.map(async ({ product_id, updates }) => {
        try {
          const existing = await productRepository.findById(product_id);
          if (!existing) return;
          const updated = await productRepository.update(product_id, updates);
          await stockLogRepository.write({
            product_id,
            user_id: user.id,
            delta_qty: 0,
            stok_sebelum: existing.stok,
            stok_sesudah: existing.stok,
            source_type: "manual",
            rule_triggered: null,
            rule_action: "ACCEPTED",
            reason_detail: `Data barang diperbarui oleh ${user.username} selama proses stok masuk`,
            context_payload: { before: existing, after: updated, changed_by: user.username, changes: updates },
          });
          console.log(`[POS-PURCHASES] Updated product ${product_id} master data`);
        } catch (err) {
          console.warn(`[POS-PURCHASES] Gagal update produk ${product_id}:`, err.message);
        }
      })
    );
  }

  // Nota SENGAJA disimpan di Storage setelah commit (untuk keperluan audit —
  // sesuai Bab 3.2.6.4 skripsi). Admin dapat menghapusnya manual via Supabase
  // bila perlu. Jangan auto-delete di sini.
  return detail;
}

async function listPurchases(filter) {
  return purchaseRepository.list(filter);
}

// ---------- Drafts (Cross-device Resume) ----------
async function saveDraft({ user, payload }) {
  if (!payload?.file_nota_url) {
    const e = new Error("file_nota_url wajib ada untuk menyimpan draft");
    e.status = 400;
    throw e;
  }
  return purchaseRepository.saveDraft({
    draftId: payload.id || null,
    userId: user.id,
    noNotaSupplier: payload.no_nota_supplier,
    supplierName: payload.supplier_name?.trim() || null,
    fileNotaUrl: payload.file_nota_url,
    notaType: payload.nota_type,
    rawText: payload.raw_text,
    preprocessing: payload.preprocessing,
    quality: payload.quality,
    items: payload.items,
    status: payload.status,
  });
}

async function listDrafts({ user }) {
  return purchaseRepository.listDrafts(user.id);
}

async function getDraft({ user, draftId }) {
  const draft = await purchaseRepository.getDraft({
    draftId,
    userId: user.id,
  });
  if (!draft) {
    const e = new Error("Draft tidak ditemukan");
    e.status = 404;
    throw e;
  }
  return draft;
}

async function deleteDraft({ user, draftId }) {
  // Ambil file_nota_url sebelum hapus record DB
  let fileUrl;
  try {
    const draft = await purchaseRepository.getDraft({ draftId, userId: user.id });
    fileUrl = draft?.file_nota_url;
  } catch {
    // abaikan — tetap lanjut hapus record
  }
  await purchaseRepository.deleteDraft({ draftId, userId: user.id });
  // Hapus nota dari Storage (fire-and-forget)
  if (fileUrl) {
    purchaseRepository.deleteNotaFile(fileUrl).catch((e) =>
      console.warn("[POS-PURCHASES] draft file delete:", e.message)
    );
  }
  return true;
}

// Hapus file nota dari Storage secara eksplisit (dipanggil frontend saat cancel)
async function deleteFile({ fileUrl }) {
  if (!fileUrl) return;
  await purchaseRepository.deleteNotaFile(fileUrl);
}

module.exports = {
  processOcr,
  commitPurchase,
  listPurchases,
  saveDraft,
  listDrafts,
  getDraft,
  deleteDraft,
  deleteFile,
};
