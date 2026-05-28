// ocrService.js — Pipeline OCR (jalur CETAK + jalur TULISAN TANGAN)

const sharp = require("sharp");
const { createWorker } = require("tesseract.js");
const { GoogleGenerativeAI } = require("@google/generative-ai");

let _cv = null;
let _cvLoadError = null;
function getCv() {
  if (_cv) return _cv;
  if (_cvLoadError) throw _cvLoadError;
  try {
    _cv = require("@u4/opencv4nodejs");
    return _cv;
  } catch (err) {
    _cvLoadError = new Error(
      "OCV_NOT_AVAILABLE: modul @u4/opencv4nodejs belum terpasang/ter-build."
    );
    _cvLoadError.code = "OCV_NOT_AVAILABLE";
    throw _cvLoadError;
  }
}

// ---------- 1. Otsu Thresholding manual ----------
function computeOtsuThreshold(rawGreyBuffer) {
  const histogram = new Array(256).fill(0);
  for (let i = 0; i < rawGreyBuffer.length; i++) histogram[rawGreyBuffer[i]]++;
  const total = rawGreyBuffer.length;

  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * histogram[t];

  let sumB = 0;
  let wB = 0;
  let varMax = 0;
  let threshold = 127;

  for (let t = 0; t < 256; t++) {
    wB += histogram[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;

    sumB += t * histogram[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);

    if (between > varMax) {
      varMax = between;
      threshold = t;
    }
  }
  if (threshold <= 0 || threshold >= 255) threshold = 127;
  return threshold;
}

// ---------- 1b. Deteksi kertas berwarna ----------
async function detectPaperColor(inputBuffer) {
  const { data, info } = await sharp(inputBuffer)
    .rotate()
    .resize(400, 400, { fit: "inside", withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels;
  const totalPx = info.width * info.height;
  let sumR = 0, sumG = 0, sumB = 0;
 
  for (let i = 0; i < data.length; i += channels) {
    sumR += data[i];
    sumG += data[i + 1];
    sumB += data[i + 2];
  }
  const meanR = sumR / totalPx;
  const meanG = sumG / totalPx;
  const meanB = sumB / totalPx;

  const dRG = meanR - meanG;
  const dRB = meanR - meanB;
  const dGB = meanG - meanB;
  const isColored = Math.abs(dRG) > 18 || Math.abs(dRB) > 18 || Math.abs(dGB) > 18;

  // FIX PENTING: Ekstrak channel di mana warna kertas paling terang, agar background jadi putih!
  let dominantChannel = "green";
  if (meanR > meanG + 10 && meanR > meanB + 10) dominantChannel = "red"; // Kertas merah/pink -> Ekstrak Red
  else if (meanB > meanR + 10 && meanB > meanG + 10) dominantChannel = "blue"; // Kertas biru -> Ekstrak Blue
  else if (meanG > meanR + 10 && meanG > meanB + 10) dominantChannel = "green";

  return {
    is_colored: isColored,
    dominant_channel: dominantChannel,
    mean_r: Math.round(meanR),
    mean_g: Math.round(meanG),
    mean_b: Math.round(meanB),
  };
}

// ---------- 2. Pipeline preprocessing ----------
const PRINTED_TARGET_WIDTH = 2400;

async function preprocessPrintedColored(inputBuffer, channelName) {
  const meta = await sharp(inputBuffer).rotate().metadata();
  const targetWidth = Math.max(meta.width || 0, PRINTED_TARGET_WIDTH);
  const ch = channelName === "red" ? "red" : channelName === "green" ? "green" : "blue";

  const oneChannel = await sharp(inputBuffer)
    .rotate()
    .resize({ width: targetWidth, kernel: "lanczos3", withoutEnlargement: false })
    .extractChannel(ch)
    .normalize()
    .toBuffer();

  const { data: rawCh } = await sharp(oneChannel).raw().toBuffer({ resolveWithObject: true });
  const otsuValue = computeOtsuThreshold(rawCh);

  const processed = await sharp(oneChannel)
    .median(3)
    .threshold(otsuValue)
    .toBuffer();

  return { processed, otsuValue, channel: ch, width: meta.width, height: meta.height, upscaled_to: targetWidth };
}

async function preprocessPrintedGentle(inputBuffer) {
  const meta = await sharp(inputBuffer).rotate().metadata();
  const targetWidth = Math.max(meta.width || 0, PRINTED_TARGET_WIDTH);

  const processed = await sharp(inputBuffer)
    .rotate()
    .resize({ width: targetWidth, kernel: "lanczos3", withoutEnlargement: false })
    .greyscale()
    .normalize()
    .linear(1.25, -20)
    .sharpen({ sigma: 0.5 })
    .toBuffer();

  return { processed, width: meta.width, height: meta.height, upscaled_to: targetWidth };
}

async function preprocessPrintedAggressive(inputBuffer) {
  const meta = await sharp(inputBuffer).rotate().metadata();
  const targetWidth = Math.max(meta.width || 0, PRINTED_TARGET_WIDTH);

  const { data: rawGrey } = await sharp(inputBuffer)
    .rotate()
    .resize({ width: targetWidth, kernel: "lanczos3", withoutEnlargement: false })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const otsuValue = computeOtsuThreshold(rawGrey);

  const processed = await sharp(inputBuffer)
    .rotate()
    .resize({ width: targetWidth, kernel: "lanczos3", withoutEnlargement: false })
    .greyscale()
    .normalize()
    .median(3)
    .threshold(otsuValue)
    .toBuffer();

  return { processed, otsuValue, width: meta.width, height: meta.height, upscaled_to: targetWidth };
}

async function preprocessPrinted(inputBuffer) { return preprocessPrintedGentle(inputBuffer); }

// ---------- 3. Tesseract recognize ----------
let _worker = null;
let _workerInitPromise = null;

async function getWorker() {
  if (_worker) return _worker;
  if (_workerInitPromise) return _workerInitPromise;

  _workerInitPromise = (async () => {
    console.log("[POS-OCR] Initializing tesseract worker (ind+eng)...");
    const worker = await createWorker("ind+eng", 1, {
      logger: (m) => { if (m.status === "recognizing text" && m.progress === 1) console.log(`[POS-OCR] Recognize done`); },
    });
    await worker.setParameters({ tessedit_pageseg_mode: "6", preserve_interword_spaces: "1" });
    _worker = worker;
    return worker;
  })();
  return _workerInitPromise;
}

async function terminateWorker() {
  if (_worker) {
    await _worker.terminate();
    _worker = null;
    _workerInitPromise = null;
  }
}

// ---------- 4. Parser Word-Level ----------
const SKIP_LINE_RE = /^(total|sub\s?total|grand\s?total|invoice|nota|tanggal|tgl|tanda\s+terima|hormat|tunai|kembalian|ppn|pajak|diskon\s+total|pot\.?|potongan|biaya|terbilang|disetujui|disiapkan|kepada|alamat|telp\.?|hp|email|kode\s+pel|nama\s+pel|kabag|disetorkan|banyaknya|nama\s+barang|harga\s|jumlah|kode\s|qty\s*$|barang\s*$|merk|satuan|admin|cashier|kasir|no\.?\s*kd|kd\.?\s*item|kd\.?\s*barang|nama\s*item|jml\b|sat\.?\s|pot\s*%|asia\s+jaya|dept|transaksi|s1[-\s]\d|tr\s*:|peja\s*:|hormat\s+kami|pelanggan|customer|sales)/i;

// FIX PENTING: Regex lebih santai, boleh tanpa strip, boleh kombinasi huruf & angka
const STRICT_ITEM_CODE_RE = /^[A-Z0-9-]+$/;
const WORD_CONFIDENCE_MIN = 60;

// FIX PENTING: Zone overlap diperluas agar menampung penomoran dan baris miring
const ZONE_CODE_MIN = 0.05;
const ZONE_CODE_MAX = 0.40;
const ZONE_NAME_MIN = 0.25;
const ZONE_NAME_MAX = 0.70;
const ZONE_QTY_MIN = 0.55;
const ZONE_QTY_MAX = 0.85;
const ZONE_PRICE_MIN = 0.75;
const ZONE_PRICE_MAX = 1.00;

function isValidItemCode(token) {
  if (!token) return false;
  const t = String(token).toUpperCase().trim();
  if (t.length < 4 || t.length > 25) return false;
  if (!STRICT_ITEM_CODE_RE.test(t)) return false;
  if (!/\d/.test(t)) return false; // Wajib minimal 1 angka
 
  const letters = (t.match(/[A-Z]/g) || []).length;
  const total = t.replace(/-/g, "").length;
  if (total === 0) return false;
  if (letters / total > 0.85) return false; // Maksimal 85% huruf
  return true;
}

const TRANSACTION_HEADER_RE = /\b(?:S[1lLI|i!]|51)[-\s]?\d{6,10}\b/;

function isDecorativeLine(text) {
  const stripped = String(text || "").replace(/\s/g, "");
  if (stripped.length < 4) return true;
  const punctCount = (stripped.match(/[^a-zA-Z0-9]/g) || []).length;
  if (punctCount / stripped.length > 0.6) return true;
  if (!/[a-zA-Z]/.test(stripped)) return true;
  return false;
}

function parseAmount(str) {
  const cleaned = String(str).replace(/[^\d.,]/g, "");
  if (!cleaned) return 0;
  const decimalMatch = cleaned.match(/^(.+)[.,](\d{2})$/);
  if (decimalMatch) {
    const intPart = decimalMatch[1].replace(/[.,]/g, "");
    return parseInt(intPart, 10) || 0;
  }
  return parseInt(cleaned.replace(/[.,]/g, ""), 10) || 0;
}

function avgConfidenceOfWords(words) {
  if (!words || words.length === 0) return 0;
  const sum = words.reduce((s, w) => s + (w.confidence || 0), 0);
  return Math.round(sum / words.length);
}

const UNIT_RE_SRC = "pcs?|pc|unit|btl|botol|pak|paket|set|kg|gr|gram|bal|bks|bungkus|bh|buah|lusin|dus|krg|karung|liter|ltr|l|ml|ekor|roll|lbr|lembar|sak|kaleng|kotak|tube|sachet|rim|sht";

function groupWordsIntoRows(words, baseThreshold = 15) {
  if (!words || words.length === 0) return [];
  const valid = words.filter(w => w && w.bbox && typeof w.bbox.y0 === "number" && typeof w.bbox.y1 === "number" && String(w.text || "").trim().length > 0);
  if (valid.length === 0) return [];

  const yCenter = (w) => (w.bbox.y0 + w.bbox.y1) / 2;
  const hOf = (w) => w.bbox.y1 - w.bbox.y0;

  const heights = valid.map(hOf).sort((a, b) => a - b);
  const medianH = heights[Math.floor(heights.length / 2)] || 20;
 
  // FIX PENTING: Toleransi vertikal dinaikkan ke 0.65x agar kata yang agak naik-turun tetap sebaris
  const yThr = Math.max(baseThreshold, medianH * 0.65);

  const sorted = [...valid].sort((a, b) => yCenter(a) - yCenter(b));
  const rows = [];
  let curr = [sorted[0]];
  let currYC = yCenter(sorted[0]);

  for (let i = 1; i < sorted.length; i++) {
    const w = sorted[i];
    const wc = yCenter(w);
    if (Math.abs(wc - currYC) <= yThr) {
      curr.push(w);
      currYC = curr.reduce((s, x) => s + yCenter(x), 0) / curr.length;
    } else {
      curr.sort((a, b) => a.bbox.x0 - b.bbox.x0);
      rows.push(curr);
      curr = [w];
      currYC = wc;
    }
  }
  if (curr.length > 0) {
    curr.sort((a, b) => a.bbox.x0 - b.bbox.x0);
    rows.push(curr);
  }
  return rows;
}

function wordsInZone(rowWords, xMinFrac, xMaxFrac, imageWidth) {
  return rowWords.filter((w) => {
    const xc = (w.bbox.x0 + w.bbox.x1) / 2;
    const xcFrac = xc / imageWidth;
    return xcFrac >= xMinFrac && xcFrac < xMaxFrac;
  });
}

function joinWordTexts(words) {
  return words.slice().sort((a, b) => a.bbox.x0 - b.bbox.x0).map((w) => String(w.text || "").trim()).filter((t) => t.length > 0).join(" ");
}

function extractItemCodeFromZone(zoneText) {
  if (!zoneText) return null;
  const cleaned = String(zoneText).toUpperCase().replace(/[^A-Z0-9\s-]/g, " ");
  const tokens = cleaned.split(/\s+/).filter(t => t.length > 0);

  // Coba per kata (untuk kode tanpa strip atau yg utuh)
  for (const t of tokens) {
    if (isValidItemCode(t)) return t;
  }
 
  // Fallback: Gabung 2 kata jika tesseract memisahkan kode dengan spasi (misal "SVT" "E2104")
  for (let i = 0; i < tokens.length - 1; i++) {
    const combined = tokens[i] + tokens[i+1];
    if (isValidItemCode(combined) && combined.length >= 5) return combined;
    const combinedDash = tokens[i] + "-" + tokens[i+1];
    if (isValidItemCode(combinedDash)) return combinedDash;
  }
  return null;
}

function extractQtyFromZone(zoneText) {
  if (!zoneText) return { qty: 0, unit: "" };
  const text = String(zoneText);
  const withUnit = text.match(new RegExp(`(\\d+(?:[,.]\\d+)?)\\s*(${UNIT_RE_SRC})\\b`, "i"));
  if (withUnit) {
    const qty = Math.round(parseFloat(withUnit[1].replace(",", ".")));
    if (qty >= 1 && qty <= 99999) return { qty, unit: withUnit[2].toUpperCase() };
  }
  const m = text.match(/\b(\d+(?:[,.]\d+)?)\b/);
  if (m) {
     const qty = Math.round(parseFloat(m[1].replace(",", ".")));
     if (qty >= 1 && qty <= 99999) return { qty, unit: "" };
  }
  return { qty: 0, unit: "" };
}

function extractPriceFromZone(zoneText) {
  if (!zoneText) return 0;
  // Ganti huruf dengan spasi agar angka tidak menyatu
  const noAlpha = String(zoneText).replace(/[a-zA-Z]/g, " ");
  const tokens = noAlpha.match(/\d+/g);
  if (!tokens || tokens.length === 0) return 0;

  let work = tokens.slice();
  if (work.length >= 2 && work[work.length - 1].length === 2 && work.slice(0, -1).some((t) => t.length >= 3)) {
    work = work.slice(0, -1);
  }

  if (work.length >= 2 && work[0].length >= 1 && work[0].length <= 3 && work.slice(1).every((t) => t.length === 3)) {
    const v = parseInt(work.join(""), 10) || 0;
    return v >= 100 ? v : 0;
  }

  if (work.length === 1) {
    const raw = String(zoneText).match(/[\d.,]+/g);
    if (raw && raw.length) {
      let best = 0;
      for (const r of raw) {
        const v = parseAmount(r);
        if (v > best) best = v;
      }
      return best >= 100 ? best : 0; // Toleransi min harga 100
    }
    const v = parseInt(work[0], 10) || 0;
    return v >= 100 ? v : 0;
  }

  let largest = work[0];
  for (const t of work) if (t.length > largest.length) largest = t;
  const v = parseInt(largest, 10) || 0;
  return v >= 100 ? v : 0;
}

function extractItemNameFromZone(zoneText) {
  if (!zoneText) return "";
  let name = String(zoneText).replace(/[^a-zA-Z0-9\s/.\-]/g, " ").replace(/\s+/g, " ").trim();
  // Strip trailing artifacts from price/qty zone bleed-over (e.g. "dobel stater 0 00 k")
  // Pattern: 2+ consecutive pure-numeric tokens (± trailing short unit letter)
  name = name.replace(/(\s+\d+){2,}(\s+[a-zA-Z]{1,3})?$/, "").trim();
  // Also strip a single numeric token followed by 1-char unit at the very end
  name = name.replace(/\s+\d+\s+[a-zA-Z]$/, "").trim();
  return name;
}

function extractDiscountFromRow(rowText) {
  if (!rowText) return 0;
  const m = String(rowText).match(/(\d{1,2}(?:[.,]\d{1,2})?)\s*%/);
  if (!m) return 0;
  const v = parseFloat(m[1].replace(",", "."));
  return v >= 0 && v <= 100 ? v : 0;
}

function parseWordsToRows(data, imageWidth) {
  const allWords = [];
  for (const ln of data?.lines || []) {
    for (const w of ln.words || []) {
      if (w && w.bbox && String(w.text || "").trim()) {
        allWords.push(w);
      }
    }
  }
  if (allWords.length === 0) return [];

  const usable = allWords.filter((w) => (w.confidence || 0) >= 30);
  const rows = groupWordsIntoRows(usable);

  const items = [];
  let transactionIndex = 0;
  let lastTransactionCode = null;

  const avgConf = (arr) => arr.length ? Math.round(arr.reduce((s, w) => s + (w.confidence || 0), 0) / arr.length) : 0;

  for (const rowWords of rows) {
    const rowText = joinWordTexts(rowWords);

    const trxMatch = rowText.match(/\b(?:S[1lLI|i!]|51)[-\s]?(\d{6,10})\b/);
    if (trxMatch) {
      const code = trxMatch[0];
      if (code !== lastTransactionCode) {
        if (items.length > 0) transactionIndex++;
        lastTransactionCode = code;
      }
      continue;
    }

    if (rowText.length < 6 || SKIP_LINE_RE.test(rowText) || isDecorativeLine(rowText)) continue;

    const codeWords = wordsInZone(rowWords, ZONE_CODE_MIN, ZONE_CODE_MAX, imageWidth);
    const nameWords = wordsInZone(rowWords, ZONE_NAME_MIN, ZONE_NAME_MAX, imageWidth);
    const qtyWords = wordsInZone(rowWords, ZONE_QTY_MIN, ZONE_QTY_MAX, imageWidth);
    const priceWords = wordsInZone(rowWords, ZONE_PRICE_MIN, ZONE_PRICE_MAX, imageWidth);

    let kode_barang = extractItemCodeFromZone(joinWordTexts(codeWords));
    if (!kode_barang) {
      const leftHalf = wordsInZone(rowWords, 0, 0.50, imageWidth);
      kode_barang = extractItemCodeFromZone(joinWordTexts(leftHalf));
    }
   
    // VALIDASI KODE: Wajib Ada
    if (!kode_barang) continue;

    let harga_beli = extractPriceFromZone(joinWordTexts(priceWords));
    if (harga_beli < 100) {
      const rightFallback = wordsInZone(rowWords, ZONE_QTY_MAX, 1.0, imageWidth);
      if (rightFallback.length > 0) harga_beli = extractPriceFromZone(joinWordTexts(rightFallback));
    }
    if (harga_beli < 100) {
      const wideRight = wordsInZone(rowWords, 0.50, 1.0, imageWidth);
      const exclQty = wideRight.filter((w) => !qtyWords.includes(w));
      harga_beli = extractPriceFromZone(joinWordTexts(exclQty));
    }
   
    // VALIDASI HARGA: Wajib Ada
    if (harga_beli < 100) continue;

    const { qty, unit } = extractQtyFromZone(joinWordTexts(qtyWords));

    let nama_barang = extractItemNameFromZone(joinWordTexts(nameWords));
    if (!nama_barang || nama_barang.length < 3) {
      const codeMaxX = codeWords.length ? Math.max(...codeWords.map((w) => w.bbox.x1)) : imageWidth * ZONE_CODE_MAX;
      const priceMinX = priceWords.length ? Math.min(...priceWords.map((w) => w.bbox.x0)) : imageWidth * ZONE_PRICE_MIN;
      const between = rowWords.filter((w) => w.bbox.x0 > codeMaxX && w.bbox.x1 < priceMinX);
      nama_barang = extractItemNameFromZone(joinWordTexts(between));
    }
    if (!nama_barang) nama_barang = "(tidak terbaca)";

    const diskon_persen = extractDiscountFromRow(rowText);

    items.push({
      raw: { kode_barang, nama_barang, qty: qty || 0, harga_beli, diskon_persen },
      confidence: { kode_barang: avgConf(codeWords), nama_barang: avgConf(nameWords), qty: avgConf(qtyWords), harga_beli: avgConf(priceWords), diskon_persen: 0 },
      line_text: rowText,
      transaction_index: transactionIndex,
      transaction_code: lastTransactionCode,
      spatial: { image_width: imageWidth, unit_detected: unit || null, n_code_words: codeWords.length, n_name_words: nameWords.length, n_qty_words: qtyWords.length, n_price_words: priceWords.length },
    });
  }
  return items;
}

function parseLineToItemTextOnly(line) {
  const text = (line.text || "").trim();
  if (text.length < 6 || SKIP_LINE_RE.test(text) || TRANSACTION_HEADER_RE.test(text) || isDecorativeLine(text) || !/[a-zA-Z]/.test(text)) return null;

  let kode_barang = "";
  const tokens = text.toUpperCase().replace(/[^A-Z0-9\s-]/g, " ").split(/\s+/);
  for (const t of tokens) {
    if (isValidItemCode(t)) {
      kode_barang = t;
      break;
    }
  }
  if (!kode_barang) return null;

  const qtyMatch = text.match(new RegExp(`\\b(\\d{1,4})(?:[.,]\\d+)?\\s*(?:${UNIT_RE_SRC})\\b`, "i")) || text.match(/(?:qty|jml|jumlah|jum|banyak)\s*[:.]?\s*(\d{1,4})/i) || text.match(/\b(\d{1,4})\s*x\s/i);
  const qtyRaw = qtyMatch ? parseInt(qtyMatch[1], 10) : null;
  const qty = qtyRaw && qtyRaw <= 9999 ? qtyRaw : 0;

  let harga_beli = 0;
  let hargaMatch = text.match(/(?:rp\.?|idr)\s*([\d.,]+)/i);
  if (hargaMatch) {
    harga_beli = parseAmount(hargaMatch[1]);
  } else {
    const tDot = text.match(/\b\d{1,3}(?:[.,]\d{3}){1,3}(?:[.,]\d{2})?\b/g) || [];
    const tSpace = text.match(/\b\d{1,3}(?:\s+\d{3}){1,3}\b/g) || [];
    const vals = [...tDot, ...tSpace].map((t) => parseAmount(t.replace(/\s+/g, "."))).filter((v) => v >= 100);
    if (vals.length) {
      vals.sort((a, b) => a - b);
      harga_beli = vals.length >= 3 ? vals[Math.floor(vals.length / 2)] : vals[0];
      hargaMatch = { 0: [...tDot, ...tSpace][0] || "" };
    }
  }

  const diskMatch = text.match(/(\d{1,2}(?:[.,]\d{1,2})?)\s*%/);
  const diskon_persen = diskMatch ? parseFloat(String(diskMatch[1]).replace(",", ".")) || 0 : 0;

  let leftover = text;
  if (qtyMatch) leftover = leftover.replace(qtyMatch[0], " ");
  leftover = leftover.replace(/(?:rp\.?|idr)\s*[\d.,]+/gi, " ").replace(/\b\d{1,3}(?:[.,]\d{3}){1,3}(?:[.,]\d{2})?\b/g, " ");
  if (diskMatch) leftover = leftover.replace(diskMatch[0], " ");
  leftover = leftover.replace(kode_barang, " ");
  const nama_barang = leftover.replace(/[^a-zA-Z0-9\s/]/g, " ").replace(/\s+/g, " ").trim();

  if (!nama_barang || nama_barang.length < 3) return null;

  const words = line.words || [];
  const overall = avgConfidenceOfWords(words);
  return {
    raw: { kode_barang, nama_barang, qty, harga_beli, diskon_persen },
    confidence: { kode_barang: overall, nama_barang: overall, qty: overall, harga_beli: overall, diskon_persen: overall },
    line_text: text,
  };
}

function inferImageWidth(lines) {
  let maxX = 0;
  for (const ln of lines || []) {
    for (const w of ln.words || []) {
      if (w.bbox && typeof w.bbox.x1 === "number" && w.bbox.x1 > maxX) maxX = w.bbox.x1;
    }
  }
  return maxX;
}

function parseTesseractData(data) {
  let lines = data?.lines || [];
  const overallConf = typeof data?.confidence === "number" ? data.confidence : 0;
  const imageWidth = inferImageWidth(lines);
  const useSpatial = imageWidth > 0 && lines.length > 0;

  if (useSpatial) {
    const items = parseWordsToRows(data, imageWidth);
    if (overallConf > 0) {
      for (const it of items) {
        if (Object.values(it.confidence).every((v) => v === 0)) {
          it.confidence = { kode_barang: overallConf, nama_barang: overallConf, qty: overallConf, harga_beli: overallConf, diskon_persen: overallConf };
        }
      }
    }
    return items;
  }

  if (lines.length === 0 && typeof data?.text === "string" && data.text.trim()) {
    lines = data.text.split(/\r?\n/).map((t) => ({ text: t, words: t.trim() ? [{ text: t, confidence: overallConf }] : [] })).filter((l) => l.text.trim().length > 0);
  }

  const items = [];
  let transactionIndex = 0;
  let lastTransactionCode = null;
  for (const line of lines) {
    const text = (line.text || "").trim();
    const trxMatch = text.match(/\b(?:S[1lLI|i!]|51)[-\s]?(\d{6,10})\b/);
    if (trxMatch) {
      const code = trxMatch[0];
      if (code !== lastTransactionCode) {
        if (items.length > 0) transactionIndex++;
        lastTransactionCode = code;
      }
      continue;
    }
    const item = parseLineToItemTextOnly(line);
    if (item) {
      if (Object.values(item.confidence).every((v) => v === 0) && overallConf > 0) {
        item.confidence = { kode_barang: overallConf, nama_barang: overallConf, qty: overallConf, harga_beli: overallConf, diskon_persen: overallConf };
      }
      item.transaction_index = transactionIndex;
      item.transaction_code = lastTransactionCode || null;
      items.push(item);
    }
  }
  return items;
}

function flagLowConfidence(items, threshold = 60) {
  return items.map((item) => {
    const vals = Object.values(item.confidence).filter((v) => v > 0);
    const avg = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
    return { ...item, confidence_avg: Math.round(avg), low_confidence: avg < threshold };
  });
}

function countValidItems(items) {
  if (!items) return 0;
  let valid = 0;
  for (const it of items) {
    const r = it.raw || {};
    const hasKode = r.kode_barang && String(r.kode_barang).length >= 4;
    const numericCount = (r.qty > 0 ? 1 : 0) + (r.harga_beli > 0 ? 1 : 0);
    if (hasKode || numericCount >= 2) valid++;
  }
  return valid;
}

async function recognizeWithPsm(worker, processedBuffer, psm) {
  await worker.setParameters({ tessedit_pageseg_mode: String(psm), preserve_interword_spaces: "1" });
  const { data } = await worker.recognize(processedBuffer);
  return data;
}

async function tryPipelineMultiPsm(worker, processedBuffer, label) {
  let best = { data: null, items: [], psm: 6, valid: -1 };
  for (const psm of [6, 4]) {
    const data = await recognizeWithPsm(worker, processedBuffer, psm);
    const items = flagLowConfidence(parseTesseractData(data), 60);
    const valid = countValidItems(items);
    console.log(`[POS-OCR] ${label} PSM=${psm} → ${items.length} item (${valid} valid)`);
    if (valid > best.valid || (valid === best.valid && items.length > best.items.length)) {
      best = { data, items, psm, valid };
    }
  }
  return best;
}

async function recognizePrintedReceipt(inputBuffer) {
  const worker = await getWorker();
  const color = await detectPaperColor(inputBuffer);
  
  let chosen = null, pipelineUsed = "", otsuValue = null, metaWidth = 0, metaHeight = 0, upscaledTo = 0;

  if (color.is_colored) {
    const colored = await preprocessPrintedColored(inputBuffer, color.dominant_channel);
    chosen = await tryPipelineMultiPsm(worker, colored.processed, `colored/${colored.channel}`);
    pipelineUsed = `sharp/printed/colored-${colored.channel}/psm${chosen.psm}`;
    otsuValue = colored.otsuValue; metaWidth = colored.width; metaHeight = colored.height; upscaledTo = colored.upscaled_to;
  } else {
    const gentle = await preprocessPrintedGentle(inputBuffer);
    chosen = await tryPipelineMultiPsm(worker, gentle.processed, "gentle");
    pipelineUsed = `sharp/printed/gentle/psm${chosen.psm}`;
    metaWidth = gentle.width; metaHeight = gentle.height; upscaledTo = gentle.upscaled_to;
  }

  if (chosen.valid <= 1) {
    console.log("[POS-OCR] Pass utama hasil minim → retry aggressive");
    const aggressive = await preprocessPrintedAggressive(inputBuffer);
    const result = await tryPipelineMultiPsm(worker, aggressive.processed, "aggressive");
    if (result.valid > chosen.valid) {
      chosen = result; pipelineUsed = `sharp/printed/aggressive/psm${result.psm}`; otsuValue = aggressive.otsuValue;
    }
  }

  const rawOcrText = chosen.data?.text || "";

  // ==========================================
  // HYBRID CASCADE: Gemini Vision → Claude Vision → Groq → Regex
  // Tier 1 & 3 gratis, Tier 2 opsional (berbayar)
  // ==========================================
  let finalItems = [];

  const aiParsedItems = await parseWithGeminiVision(inputBuffer, rawOcrText)
    || await parseWithClaudeVision(inputBuffer, rawOcrText)
    || await parseWithGroq(rawOcrText);

  if (aiParsedItems && aiParsedItems.length > 0) {
    const lineText = aiParsedItems[0]?.line_text || "";
    const src = lineText.match(/\(([^)]+)\)/)?.[1] || "Unknown";
    console.log(`[POS-OCR] AI (${src}) berhasil mengekstrak ${aiParsedItems.length} produk.`);
    finalItems = aiParsedItems;
    pipelineUsed += ` + AI-${src}`;
  } else {
    console.log("[POS-OCR] Semua AI gagal. Fallback ke parser Regex tradisional.");
    finalItems = chosen.items;
  }

  return { raw_text: rawOcrText,
    preprocessing: { pipeline: pipelineUsed, otsu_threshold: otsuValue, paper_color: color,width: metaWidth, height: metaHeight, upscaled_to: upscaledTo },
    items: finalItems };
}

// JALUR TULISAN TANGAN (opencv4nodejs)

function detectTextLines(binaryMat, cv) {
  const height = binaryMat.rows, width = binaryMat.cols;
  const rowSums = new Array(height).fill(0);
  const data = binaryMat.getDataAsArray();
  for (let y = 0; y < height; y++) {
    let s = 0;
    for (let x = 0; x < width; x++) if (data[y][x] > 0) s++;
    rowSums[y] = s;
  }
  const threshold = Math.max(3, Math.floor(width * 0.015));
  const lines = [];
  let inLine = false, yStart = 0;
  for (let y = 0; y < height; y++) {
    if (rowSums[y] >= threshold) {
      if (!inLine) { inLine = true; yStart = y; }
    } else if (inLine) {
      inLine = false;
      if (y - yStart >= 8 && y - yStart <= height * 0.5) lines.push({ yStart, yEnd: y });
    }
  }
  if (inLine) lines.push({ yStart, yEnd: height });
  return lines;
}

function estimateLineSkew(lineMat, cv) {
  const contours = lineMat.findContours(cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
  if (!contours || contours.length === 0) return 0;
  let largest = contours[0];
  for (const c of contours) if (c.area > largest.area) largest = c;
  if (largest.area < 50) return 0;
  const rect = largest.minAreaRect();
  let angle = rect.angle;
  if (angle < -45) angle += 90;
  if (angle < -15) angle = -15;
  if (angle > 15) angle = 15;
  return angle;
}

function deskewPerLineMat(binaryMat, cv) {
  const lines = detectTextLines(binaryMat, cv);
  if (lines.length === 0) return binaryMat;

  const height = binaryMat.rows, width = binaryMat.cols;
  const out = new cv.Mat(height, width, cv.CV_8UC1, [0]);

  for (const ln of lines) {
    const pad = Math.min(8, ln.yStart, height - ln.yEnd);
    const y0 = ln.yStart - pad, y1 = ln.yEnd + pad;
    const region = binaryMat.getRegion(new cv.Rect(0, y0, width, y1 - y0));
    const angle = estimateLineSkew(region.copy(), cv);
    let rotated;
    if (Math.abs(angle) < 0.5) {
      rotated = region.copy();
    } else {
      const M = cv.getRotationMatrix2D(new cv.Point2(width / 2, (y1 - y0) / 2), angle, 1.0);
      rotated = region.warpAffine(M, new cv.Size(width, y1 - y0), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Vec(0, 0, 0));
    }
    rotated.copyTo(out.getRegion(new cv.Rect(0, y0, width, y1 - y0)));
  }
  return out;
}

async function preprocessHandwritten(inputBuffer) {
  const cv = getCv();
  const orientedBuffer = await sharp(inputBuffer).rotate().toBuffer();
  let src = cv.imdecode(orientedBuffer);
  if (!src || src.empty) throw new Error("Gagal decode gambar dengan opencv");

  const gray = src.channels === 1 ? src : src.cvtColor(cv.COLOR_BGR2GRAY);
  const smoothed = gray.bilateralFilter(9, 75, 75);
  const adaptive = smoothed.adaptiveThreshold(255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 11, 2);
  const deskewed = deskewPerLineMat(adaptive, cv);
 
  const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(2, 2));
  const dilated = deskewed.dilate(kernel, new cv.Point2(-1, -1), 1);
  const finalBin = dilated.bitwiseNot();
  const pngBuffer = cv.imencode(".png", finalBin);

  return { processed: pngBuffer, width: src.cols, height: src.rows, n_lines_detected: detectTextLines(adaptive, cv).length };
}

async function recognizeHandwrittenReceipt(inputBuffer) {
  const { processed, width, height, n_lines_detected } = await preprocessHandwritten(inputBuffer);
  const worker = await getWorker();
  await worker.setParameters({ tessedit_pageseg_mode: "6", preserve_interword_spaces: "1" });
  const { data } = await worker.recognize(processed);
  let items = flagLowConfidence(parseTesseractData(data), 45);
  return { raw_text: data.text || "", preprocessing: { pipeline: "opencv/handwritten", width, height, n_lines_detected }, items };
}

// HYBRID AI PARSER — Claude Vision (Anthropic) + Groq fallback

// System prompt — dipakai oleh semua AI provider
const AI_SYSTEM_PROMPT = `Anda adalah agen ekstraksi data nota ahli untuk toko suku cadang motor CV Asia Jaya Maju.
Tugas Anda: mem-parsing nota pembelian supplier menjadi array JSON yang valid.

<rules>
1. BACA DENGAN TELITI: Nota dot-matrix sering punya noise, typo, kolom bergeser, dan karakter ambigu.
2. SANITASI KODE: Perbaiki OCR typo pada kode barang (misal '5VT' → 'SVT', '0' → 'O' jika konteks huruf, 'l' → '1' jika konteks angka).
3. PENALARAN ANGKA: Jika angka terpotong, ingat bahwa [Harga Total ≈ Qty × Harga Beli]. Gunakan logika ini untuk mengoreksi angka yang salah baca.
4. ABAIKAN: header toko, alamat, tanggal, nomor nota, footer, total, subtotal, pajak/PPN, potongan keseluruhan, dan nomor urut. Fokus HANYA pada baris item barang.
5. STRICT OUTPUT: Respons Anda HANYA boleh berupa array JSON murni. Tanpa markdown, tanpa penjelasan, tanpa blockquote.
</rules>

<schema>
Keluarkan TEPAT array JSON dengan struktur:
[
  {
    "kode_barang": "string (kode produk, wajib jika terlihat di nota)",
    "nama_barang": "string (nama produk lengkap, wajib)",
    "qty": number (jumlah barang, integer, wajib),
    "harga_beli": number (harga satuan Rupiah, integer tanpa titik/koma, wajib),
    "diskon_persen": number (persentase diskon, default 0),
    "transaction_code": "string|null (kode transaksi misal S1-25120493 jika ada)"
  }
]
</schema>`;

// TIER 1: Gemini Vision (GRATIS — support gambar)
// Model cascade: gemini-2.0-flash → gemini-2.0-flash-lite
// Deteksi "limit: 0" (kuota harian habis) → langsung skip, tidak retry
// Retry hanya untuk rate-limit sementara (per-menit)
const GEMINI_MODELS = ["gemini-1.5-flash", "gemini-1.5-flash-8b"];

function isGeminiDailyQuotaExhausted(errorMsg) {
  return errorMsg?.includes("limit: 0") || errorMsg?.includes("PerDay");
}

async function callGeminiModel(genAI, modelName, imagePart, textPart) {
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: AI_SYSTEM_PROMPT,
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
    },
  });
  const result = await model.generateContent([imagePart, textPart]);
  return result.response.text();
}

async function parseWithGeminiVision(imageBuffer, rawText) {
  if (!process.env.GEMINI_API_KEY) return null;

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  const resizedImage = await sharp(imageBuffer)
    .resize({ width: 1600, withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();

  const imagePart = {
    inlineData: {
      mimeType: "image/jpeg",
      data: resizedImage.toString("base64"),
    },
  };

  const textPart = rawText
    ? `Ekstrak semua item barang dari nota ini menjadi JSON array.\n\nSebagai referensi tambahan, berikut teks kasar OCR:\n<ocr_text>\n${rawText.slice(0, 3000)}\n</ocr_text>`
    : "Ekstrak semua item barang dari nota ini menjadi JSON array.";

  for (const modelName of GEMINI_MODELS) {
    try {
      console.log(`[POS-OCR] Mengirim gambar nota ke ${modelName} (gratis)...`);
      let responseText;

      try {
        responseText = await callGeminiModel(genAI, modelName, imagePart, textPart);
      } catch (err) {
        const is429 = err.message?.includes("429") || err.status === 429;
        if (is429 && isGeminiDailyQuotaExhausted(err.message)) {
          console.warn(`[POS-OCR] ${modelName} kuota harian habis (limit: 0) → skip langsung.`);
          continue;
        }
        if (is429) {
          const retryMatch = err.message?.match(/retry in (\d+)/i);
          const waitSec = retryMatch ? Math.min(parseInt(retryMatch[1], 10) + 2, 35) : 10;
          console.log(`[POS-OCR] ${modelName} rate-limited (sementara) → tunggu ${waitSec}s...`);
          await new Promise((r) => setTimeout(r, waitSec * 1000));
          responseText = await callGeminiModel(genAI, modelName, imagePart, textPart);
        } else {
          throw err;
        }
      }

      const parsed = JSON.parse(responseText);
      const parsedArray = Array.isArray(parsed) ? parsed :
        (parsed.items || parsed.data || parsed.products || Object.values(parsed).find(Array.isArray));

      if (!parsedArray || !Array.isArray(parsedArray) || parsedArray.length === 0) {
        console.warn(`[POS-OCR] ${modelName} → array kosong, coba model berikut...`);
        continue;
      }

      console.log(`[POS-OCR] ${modelName} berhasil ekstrak ${parsedArray.length} item.`);
      return formatAiItems(parsedArray, `Gemini-${modelName}`);
    } catch (error) {
      console.warn(`[POS-OCR] ${modelName} GAGAL: ${error.message}`);
      continue;
    }
  }

  console.warn("[POS-OCR] Semua model Gemini gagal → lanjut ke fallback.");
  return null;
}

// TIER 2: Claude Vision (BERBAYAR — lebih akurat, opsional)
async function parseWithClaudeVision(imageBuffer, rawText) {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  try {
    console.log("[POS-OCR] Fallback → mengirim gambar ke Claude Vision...");
    const Anthropic = require("@anthropic-ai/sdk").default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const resizedImage = await sharp(imageBuffer)
      .resize({ width: 1600, withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();

    const response = await client.messages.create({
      model: "claude-sonnet-4-6-20250514",
      max_tokens: 4096,
      temperature: 0,
      system: AI_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: resizedImage.toString("base64"),
              },
            },
            {
              type: "text",
              text: rawText
                ? `Ekstrak semua item barang dari nota di atas menjadi JSON array.\n\nReferensi teks OCR:\n<ocr_text>\n${rawText.slice(0, 3000)}\n</ocr_text>`
                : "Ekstrak semua item barang dari nota di atas menjadi JSON array.",
            },
          ],
        },
        { role: "assistant", content: "[" },
      ],
    });

    const responseText = "[" + response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    const parsedArray = JSON.parse(responseText);

    if (!Array.isArray(parsedArray) || parsedArray.length === 0) {
      throw new Error("Claude mengembalikan array kosong");
    }

    console.log(`[POS-OCR] Claude Vision berhasil ekstrak ${parsedArray.length} item.`);
    return formatAiItems(parsedArray, "Claude-Vision");
  } catch (error) {
    console.error("[POS-OCR] Claude Vision GAGAL:", error.message);
    return null;
  }
}

// TIER 3: Groq/Llama (GRATIS — teks saja, tanpa gambar)
async function parseWithGroq(rawText) {
  if (!process.env.GROQ_API_KEY || !rawText) return null;

  try {
    console.log("[POS-OCR] Fallback → mengirim teks ke Groq/Llama...");
    const Groq = require("groq-sdk");
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const result = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: AI_SYSTEM_PROMPT },
        { role: "user", content: `Berikut teks OCR mentah dari nota:\n<ocr_text>\n${rawText}\n</ocr_text>\n\nEkstrak menjadi JSON array sekarang.` },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
    });

    const responseText = result.choices[0].message.content;
    const parsed = JSON.parse(responseText);
    const parsedArray = Array.isArray(parsed) ? parsed :
      (parsed.items || parsed.data || parsed.products || Object.values(parsed).find(Array.isArray));

    if (!parsedArray || parsedArray.length === 0) return null;
    return formatAiItems(parsedArray, "Groq-Llama");
  } catch (error) {
    console.error("[POS-OCR] Groq Parsing GAGAL:", error.message);
    return null;
  }
}

function formatAiItems(parsedArray, source) {
  return parsedArray.map((item) => {
    const diskon = item.diskon_persen ?? item.diskon ?? 0;
    return {
      raw: {
        kode_barang: String(item.kode_barang || "").trim() || "UNKNOWN",
        nama_barang: String(item.nama_barang || "").trim() || "(tidak terbaca)",
        qty: Math.max(1, Math.round(Number(item.qty) || 1)),
        harga_beli: Math.max(0, Math.round(Number(item.harga_beli) || 0)),
        diskon_persen: Math.max(0, Math.min(100, Number(diskon) || 0)),
      },
      confidence: {
        kode_barang: 99,
        nama_barang: 99,
        qty: 99,
        harga_beli: 99,
        diskon_persen: 99,
      },
      line_text: `AI Extracted (${source}): ${item.nama_barang}`,
      transaction_index: item.transaction_code ? 1 : 0,
      transaction_code: item.transaction_code || null,
      spatial: {
        image_width: 2400, unit_detected: null,
        n_code_words: 1, n_name_words: 1, n_qty_words: 1, n_price_words: 1,
      },
    };
  });
}

module.exports = {
  recognizePrintedReceipt,
  recognizeHandwrittenReceipt,
  preprocessPrinted,
  preprocessHandwritten,
  computeOtsuThreshold,
  parseTesseractData,
  parseWordsToRows,
  parseLineToItemTextOnly,
  groupWordsIntoRows,
  wordsInZone,
  extractItemCodeFromZone,
  extractQtyFromZone,
  extractPriceFromZone,
  extractItemNameFromZone,
  isValidItemCode,
  flagLowConfidence,
  terminateWorker,
};