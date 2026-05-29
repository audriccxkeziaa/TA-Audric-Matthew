// Util baris stok-masuk: konversi item OCR/draft ↔ baris editable, baris manual
// kosong, dan kemiripan kode (Levenshtein). Murni, dipindahkan apa adanya.

let rowSeq = 0;
export const newUid = () => `row-${++rowSeq}`;

// Konversi item OCR backend → baris editable di tabel validasi.
export function ocrItemToRow(item) {
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
    needs_review: !!item.needs_review,
    review_reasons: item.review_reasons || [],
    line_text: item.line_text || "",
    candidates: cands,
    action: exactMatch ? "restock" : autoNew ? "new" : null,
    product_id: exactMatch ? top.product_id : null,
    picked_label: exactMatch ? top.nama_barang : "",
    reviewed: false,
  };
}

export function blankManualRow() {
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

// Map satu baris di tabel validasi → bentuk item untuk disimpan ke draft.
// Tidak melakukan validasi (draft boleh setengah jadi).
export function rowToDraftItem(r) {
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
    needs_review: !!r.needs_review,
    review_reasons: r.review_reasons || [],
    line_text: r.line_text || "",
    candidates: r.candidates || [],
    action: r.action || null,
    product_id: r.product_id || null,
    picked_label: r.picked_label || "",
    reviewed: !!r.reviewed,
  };
}

// Kebalikannya: item draft yg tersimpan → baris editable.
export function draftItemToRow(it) {
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
    needs_review: !!it.needs_review,
    review_reasons: it.review_reasons || [],
    line_text: it.line_text || "",
    candidates: it.candidates || [],
    action: it.action || null,
    product_id: it.product_id || null,
    picked_label: it.picked_label || "",
    reviewed: !!it.reviewed,
  };
}

// Kemiripan kode barang (Levenshtein ternormalisasi) — dipakai lookup di ItemRow.
export function kodeSimilarity(a, b) {
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
