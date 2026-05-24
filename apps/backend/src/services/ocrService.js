// =================================================================
// ocrService.js — Pipeline OCR (jalur CETAK + jalur TULISAN TANGAN)
// =================================================================
// Strategi 2 (Pipeline Preprocessing Bersyarat) — sub-bab 3.2.6.4:
//
//   JALUR CETAK (sharp) — multi-pass:
//     PASS 1 "gentle" (default — biarkan tesseract internal binarize):
//       1. Upscale ke ~2400px width (tesseract optimal di ~300 DPI;
//          foto HP umumnya 1500-2000px → upscale lanczos3)
//       2. Grayscale + normalize (auto-contrast)
//       3. Linear contrast boost (1.25, -20)
//       4. Sharpen ringan (sigma 0.5)
//     PASS 2 "aggressive" (fallback kalau pass 1 balas <= 1 item):
//       1. Upscale ke 2400px
//       2. Grayscale + normalize
//       3. Median blur kernel 3
//       4. Otsu thresholding (binarisasi keras)
//     Plus: tesseract PSM=6 (single uniform block) + preserve_interword_spaces.
//
//   JALUR TULISAN TANGAN (opencv4nodejs):
//     1. cv.cvtColor(BGR→GRAY)
//     2. cv.adaptiveThreshold(255, GAUSSIAN_C, BINARY, 11, 2)
//     3. cv.bilateralFilter(9, 75, 75)
//     4. Deskew per-baris (deteksi baris via projection profile,
//        hitung angle via minAreaRect contour, rotate per-line region)
//     5. cv.dilate(kernel 2x2, iterations=1) — dilatasi morfologis ringan
//
// Setelah preprocessing → tesseract.js dengan trained data 'ind+eng'.
// Hasil di-parse via regex untuk field: kode_barang, nama_barang, qty,
// harga_beli, diskon_persen.
//
// STRATEGI 3 — ambang confidence:
//   - cetak: terima field jika rata-rata confidence kata >= 60
//   - tulisan_tangan: terima jika >= 45 (lebih longgar)
// =================================================================

const sharp = require("sharp");
const { createWorker } = require("tesseract.js");

// opencv4nodejs lazy-load: kalau native build gagal di Windows, jangan
// crash boot server. Pipeline tulisan tangan akan throw error spesifik
// yang ditangkap purchasesService → fallback Strategi 4 manual_input.
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
      "OCV_NOT_AVAILABLE: modul @u4/opencv4nodejs belum terpasang/ter-build. " +
        "Jalankan `npm install @u4/opencv4nodejs` di apps/backend dan pastikan " +
        "Visual Studio Build Tools (C++ workload) + CMake terpasang. " +
        "Jalur OCR tulisan tangan otomatis fallback ke input manual sampai siap."
    );
    _cvLoadError.code = "OCV_NOT_AVAILABLE";
    throw _cvLoadError;
  }
}

// ---------- 1. Otsu Thresholding manual (sharp tidak punya) ----------
// Input: Buffer raw grayscale 1-channel. Output: nilai threshold 0..255.
function computeOtsuThreshold(rawGreyBuffer) {
  const histogram = new Array(256).fill(0);
  for (let i = 0; i < rawGreyBuffer.length; i++) {
    histogram[rawGreyBuffer[i]]++;
  }
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
  // Sanity clamp: hindari edge case t=0 (sharp.threshold(0) → semua piksel jadi
  // putih) atau t=255 (semua hitam). Untuk gambar bimodal sempurna 0/255, Otsu
  // bisa pilih t=0; clamp ke 127 agar pemisahan tetap masuk akal.
  if (threshold <= 0 || threshold >= 255) {
    threshold = 127;
  }
  return threshold;
}

// ---------- 1b. Deteksi kertas berwarna (carbon paper merah muda, dll) -----
// Sample mean per channel pada thumbnail kecil (cepat). Jika selisih warna > 18
// pada salah satu pasangan kanal → paper berwarna → pipeline khusus.
// Output: { is_colored, dominant_channel, mean_r, mean_g, mean_b }
async function detectPaperColor(inputBuffer) {
  // .rotate() tanpa argumen = auto-orient berdasarkan EXIF tag.
  // Wajib untuk foto langsung dari kamera HP iPhone — raw pixel-nya
  // sering miring meskipun visualnya tegak.
  const { data, info } = await sharp(inputBuffer)
    .rotate()
    .resize(400, 400, { fit: "inside", withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels;
  const totalPx = info.width * info.height;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  for (let i = 0; i < data.length; i += channels) {
    sumR += data[i];
    sumG += data[i + 1];
    sumB += data[i + 2];
  }
  const meanR = sumR / totalPx;
  const meanG = sumG / totalPx;
  const meanB = sumB / totalPx;

  // Selisih signifikan antar kanal = kertas/tinta dominan satu warna.
  const dRG = meanR - meanG;
  const dRB = meanR - meanB;
  const dGB = meanG - meanB;
  const isColored =
    Math.abs(dRG) > 18 || Math.abs(dRB) > 18 || Math.abs(dGB) > 18;

  // Pilih channel yang paling "TIDAK MIRIP" warna paper untuk ekstraksi.
  // Pink/merah → paper terang di B+G, gelap di R → ekstrak B (ink hitam tetap gelap, paper jadi terang).
  // Biru carbon → ekstrak R. Hijau → ekstrak R atau B.
  let dominantChannel = "blue";
  if (meanR >= meanG && meanR >= meanB) dominantChannel = "blue"; // R dominan → kertas merah/pink → pakai B
  else if (meanB >= meanR && meanB >= meanG) dominantChannel = "red"; // B dominan → kertas biru → pakai R
  else if (meanG >= meanR && meanG >= meanB) dominantChannel = "red"; // G dominan → pakai R

  return {
    is_colored: isColored,
    dominant_channel: dominantChannel,
    mean_r: Math.round(meanR),
    mean_g: Math.round(meanG),
    mean_b: Math.round(meanB),
  };
}

// ---------- 2. Pipeline preprocessing untuk nota CETAK ----------
// Target width untuk upscaling. Tesseract optimal ~300 DPI. Foto HP umumnya
// 1500-2000px, jadi naikkan ke 2400px supaya font kecil di tabel item kebaca.
const PRINTED_TARGET_WIDTH = 2400;

// Pipeline khusus kertas berwarna (carbon merah muda, biru, dll).
// Ekstrak satu channel (yang paling kontras dengan warna paper), normalize,
// median blur, lalu Otsu binarisasi. Ini fix utama untuk nota carbon
// merah-muda — di grayscale standar tinta hitam dan kertas merah jatuh ke
// abu-abu hampir sama (low contrast).
async function preprocessPrintedColored(inputBuffer, channelName) {
  const meta = await sharp(inputBuffer).rotate().metadata();
  const targetWidth = Math.max(meta.width || 0, PRINTED_TARGET_WIDTH);
  const ch = channelName === "red" ? "red" : channelName === "green" ? "green" : "blue";

  // Step 1: rotate (auto-orient EXIF) → resize → extract single channel → normalize
  const oneChannel = await sharp(inputBuffer)
    .rotate()
    .resize({ width: targetWidth, kernel: "lanczos3", withoutEnlargement: false })
    .extractChannel(ch)
    .normalize()
    .toBuffer();

  // Step 2: hitung Otsu pada raw 1-channel
  const { data: rawCh } = await sharp(oneChannel)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const otsuValue = computeOtsuThreshold(rawCh);

  // Step 3: median blur (buang salt-and-pepper) + threshold
  const processed = await sharp(oneChannel)
    .median(3)
    .threshold(otsuValue)
    .toBuffer();

  return {
    processed,
    otsuValue,
    channel: ch,
    width: meta.width,
    height: meta.height,
    upscaled_to: targetWidth,
  };
}

// Pass 1: gentle pipeline. JANGAN lakukan hard binarization (sharp.threshold)
// — biarkan tesseract internal binarize secara adaptif. Hasilnya lebih bagus
// untuk teks kecil dense (banyak item, font 6-8pt).
async function preprocessPrintedGentle(inputBuffer) {
  const meta = await sharp(inputBuffer).rotate().metadata();
  const targetWidth = Math.max(meta.width || 0, PRINTED_TARGET_WIDTH);

  const processed = await sharp(inputBuffer)
    .rotate()
    .resize({
      width: targetWidth,
      kernel: "lanczos3",
      withoutEnlargement: false,
    })
    .greyscale()
    .normalize()
    .linear(1.25, -20) // boost kontras lokal
    .sharpen({ sigma: 0.5 }) // sharpen ringan
    .toBuffer();

  return {
    processed,
    width: meta.width,
    height: meta.height,
    upscaled_to: targetWidth,
  };
}

// Pass 2: aggressive pipeline (Otsu binarization). Fallback kalau gentle
// gagal extract item — biasanya untuk nota kontras tinggi sederhana atau
// nota dengan banyak grafik/garis tebal.
async function preprocessPrintedAggressive(inputBuffer) {
  const meta = await sharp(inputBuffer).rotate().metadata();
  const targetWidth = Math.max(meta.width || 0, PRINTED_TARGET_WIDTH);

  const { data: rawGrey } = await sharp(inputBuffer)
    .rotate()
    .resize({
      width: targetWidth,
      kernel: "lanczos3",
      withoutEnlargement: false,
    })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const otsuValue = computeOtsuThreshold(rawGrey);

  const processed = await sharp(inputBuffer)
    .rotate()
    .resize({
      width: targetWidth,
      kernel: "lanczos3",
      withoutEnlargement: false,
    })
    .greyscale()
    .normalize()
    .median(3)
    .threshold(otsuValue)
    .toBuffer();

  return {
    processed,
    otsuValue,
    width: meta.width,
    height: meta.height,
    upscaled_to: targetWidth,
  };
}

// Backward-compat: existing tests/import yang panggil preprocessPrinted langsung
// akan dapat pipeline gentle (default baru).
async function preprocessPrinted(inputBuffer) {
  return preprocessPrintedGentle(inputBuffer);
}

// ---------- 3. Tesseract recognize (worker reusable) ----------
let _worker = null;
let _workerInitPromise = null;

async function getWorker() {
  if (_worker) return _worker;
  if (_workerInitPromise) return _workerInitPromise;

  _workerInitPromise = (async () => {
    console.log("[POS-OCR] Initializing tesseract worker (ind+eng)...");
    const worker = await createWorker("ind+eng", 1, {
      logger: (m) => {
        if (m.status === "recognizing text" && m.progress === 1) {
          console.log(`[POS-OCR] Recognize done (jobId=${m.jobId})`);
        }
      },
    });
    // PSM 6 = single uniform block of text — paling cocok untuk receipt table
    // dengan baris-baris item beraturan. preserve_interword_spaces menjaga
    // gap antar kolom supaya parser regex bisa pisahkan field.
    await worker.setParameters({
      tessedit_pageseg_mode: "6",
      preserve_interword_spaces: "1",
    });
    _worker = worker;
    return worker;
  })();

  return _workerInitPromise;
}

// Untuk graceful shutdown (jarang dipakai, opsional)
async function terminateWorker() {
  if (_worker) {
    await _worker.terminate();
    _worker = null;
    _workerInitPromise = null;
  }
}

// ---------- 4. Parser hasil tesseract (WORD-LEVEL SPATIAL) ----------
//
// Strategi parsing: BYPASS Tesseract's own line-grouping. Flatten semua
// data.words → regroup-by-Y manual → per row, isolate kolom by X-zone,
// → apply LOCALIZED REGEX per zona. Pendekatan ini robust terhadap kasus
// dot-matrix di mana Tesseract:
//   (a) salah grup line — qty Row N nyangkut ke nama Row N+1
//   (b) misread noise di kolom tengah (mis. "V 20,00 PCS" — checkmark pena
//       sebelum qty) yang sebelumnya merusak regex per-line keseluruhan.
//
//   1. Y-AXIS ROW GROUPING (groupWordsIntoRows)
//      - Cluster words by vertical center; threshold = max(15px, 0.4 × median
//        word height). Adaptive supaya bisa handle scan resolusi tinggi
//        maupun rendah.
//      - Sort top-to-bottom, lalu within-row left-to-right.
//
//   2. X-AXIS ZONE ISOLATION (wordsInZone)
//      Zone (fraksi lebar gambar):
//        CODE  10..35%   → kode barang
//        NAME  35..65%   → nama barang
//        QTY   65..80%   → qty + unit (PCS/KG/dll)
//        PRICE 80..100%  → harga
//      Word di-assign by X-center, bukan x0, supaya word lebar yang
//      straddle batas tidak nyangkut ke zona salah.
//
//   3. LOCALIZED CLEANSING (per-zona regex)
//      - CODE  : regex /\b[A-Z0-9]{2,10}-[A-Z0-9]{2,10}/ pada teks zona,
//                buang non-alphanumeric/dash dulu.
//      - QTY   : strip prefix non-digit ("V", "v", "*", tanda centang dll)
//                via match (\d+[,.]?\d*)\s*UNIT, round ke int.
//      - PRICE : buang semua huruf, deteksi pola ribuan terpisah-spasi
//                ("1 500 000"), drop trailing 2-digit cents ("1500000 00"
//                → 1500000), fallback ke largest numeric block.
//      - NAME  : sisa setelah strip non-alphanum (kecuali spasi/dash/slash).
//
//   4. ROW VALIDATION (final gate)
//      Push row HANYA jika: extractItemCodeFromZone() balas non-null
//      AND extractPriceFromZone() balas nilai ≥ 1000. Header/footer noise
//      otomatis di-drop karena tidak ada code valid di kolom kiri.
//
// Fallback (jalur PDF text-layer): ketika data tidak punya bbox/words sama
// sekali (PDF "lahir digital" via pdf-parse), pakai parseLineToItemTextOnly()
// yang TETAP menerapkan strict code anchor — tanpa spatial.

// Header tabel + footer + label non-item yang sering muncul di nota Indonesia.
// Baris yang start-with kata-kata ini akan di-skip di parser.
const SKIP_LINE_RE =
  /^(total|sub\s?total|grand\s?total|invoice|nota|tanggal|tgl|tanda\s+terima|hormat|tunai|kembalian|ppn|pajak|diskon\s+total|pot\.?|potongan|biaya|terbilang|disetujui|disiapkan|kepada|alamat|telp\.?|hp|email|kode\s+pel|nama\s+pel|kabag|disetorkan|banyaknya|nama\s+barang|harga\s|jumlah|kode\s|qty\s*$|barang\s*$|merk|satuan|admin|cashier|kasir|no\.?\s*kd|kd\.?\s*item|kd\.?\s*barang|nama\s*item|jml\b|sat\.?\s|pot\s*%|asia\s+jaya|dept|transaksi|s1[-\s]\d|tr\s*:|peja\s*:|hormat\s+kami|pelanggan|customer|sales)/i;

// Strict item code (anchor wajib). Harus alphanumeric + dash, min 1 digit,
// ≤ 70% huruf. Contoh real: 90111-08815, 93306-002YR, SVD-E1310-20,
// 5TL-E7623-00, BK6-F3145-00, 401-16111-00-30.
const STRICT_ITEM_CODE_RE = /^[A-Z0-9]+(?:-[A-Z0-9]+)+$/;

// Threshold confidence per-word (jalur cetak). Word di bawah ini dibuang
// sebelum parsing. Sinkron dengan threshold flagLowConfidence supaya
// behaviour konsisten.
const WORD_CONFIDENCE_MIN = 60;

// Zona spatial (sebagai fraksi lebar gambar). Word di-assign by X-CENTER.
const ZONE_CODE_MIN = 0.10;
const ZONE_CODE_MAX = 0.35;
const ZONE_NAME_MIN = 0.35;
const ZONE_NAME_MAX = 0.65;
const ZONE_QTY_MIN = 0.65;
const ZONE_QTY_MAX = 0.80;
const ZONE_PRICE_MIN = 0.80;
const ZONE_PRICE_MAX = 1.00;

// Threshold vertical untuk cluster word jadi row (px). Adaptive: dinaikkan
// ke 0.4 × median word-height kalau gambar resolusi tinggi.
const ROW_Y_THRESHOLD_PX = 15;

function isValidItemCode(token) {
  if (!token) return false;
  const t = String(token).toUpperCase().trim();
  if (t.length < 5 || t.length > 22) return false;
  if (!STRICT_ITEM_CODE_RE.test(t)) return false;
  if (!/\d/.test(t)) return false;
  // Tolak kalau >70% huruf (cegah tangkap kata biasa, mis. "PIRINGAN-AS")
  const letters = (t.match(/[A-Z]/g) || []).length;
  const total = t.replace(/-/g, "").length;
  if (total === 0) return false;
  if (letters / total > 0.7) return false;
  return true;
}

// Pattern untuk pemisah multi-transaksi dalam satu nota (S1-XXXXXXXX).
// OCR sering miss-read 'S1' jadi 'SL', 'Si', 'S|', '51', 'SI'. Pattern
// dibuat fuzzy untuk variasi karakter awal yang lazim di Tesseract.
// Saat ditemukan, parser anggap baris ini header transaksi baru, bukan item.
const TRANSACTION_HEADER_RE = /\b(?:S[1lLI|i!]|51)[-\s]?\d{6,10}\b/;

// Baris hanya berisi tanda baca/garis dekorasi (...) atau angka tunggal.
function isDecorativeLine(text) {
  const stripped = String(text || "").replace(/\s/g, "");
  if (stripped.length < 4) return true;
  // Lebih dari 60% karakter adalah tanda baca/garis → skip
  const punctCount = (stripped.match(/[^a-zA-Z0-9]/g) || []).length;
  if (punctCount / stripped.length > 0.6) return true;
  // Tidak ada huruf sama sekali → skip
  if (!/[a-zA-Z]/.test(stripped)) return true;
  return false;
}

function parseAmount(str) {
  // Heuristik format Indonesia + OCR confusion handling.
  //   "50.000,00"        → 50000     (titik=ribuan, koma=desimal)
  //   "50.000.00"        → 50000     (OCR salah baca koma jadi titik — desimal di akhir)
  //   "1.500.000"        → 1500000   (3 separator semua = ribuan)
  //   "1.500"            → 1500      (1 separator + 3 digit = ribuan)
  //   "1500"             → 1500      (tanpa separator)
  //   "Rp 25,000"        → 25000     (style US: koma ribuan)
  // Pendeteksi desimal: kalau diakhiri "[.,]\d{2}$" DAN ada digit lain sebelumnya,
  // anggap 2 digit terakhir adalah sen → buang.
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

// Ambil words dari sebuah line yang text-nya match substring tertentu.
function wordsMatching(words, snippet) {
  if (!snippet) return [];
  const tokens = String(snippet)
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0);
  if (tokens.length === 0) return [];
  return words.filter((w) =>
    tokens.some((t) => String(w.text).toLowerCase().includes(t))
  );
}

// Daftar satuan yang diakui parser. Ditulis terpisah untuk ditest unit.
// Indonesia common: kg, gr, bal, bks, bh, lusin, dus, krg, sak, ekor.
// English/umum: pcs, pc, unit, set, pak, btl, ml, ltr, liter, l, roll.
const UNIT_RE_SRC =
  "pcs?|pc|unit|btl|botol|pak|paket|set|kg|gr|gram|bal|bks|bungkus|bh|buah|lusin|dus|krg|karung|liter|ltr|l|ml|ekor|roll|lbr|lembar|sak|kaleng|kotak|tube|sachet|rim|sht";

// ---------- 4a. WORD-LEVEL SPATIAL parser (PATH UTAMA) ------------------
// Flatten data.words → Y-cluster jadi rows → per-row X-zone isolation →
// localized cleansing per zona → row validation (code + price wajib).

// Y-axis clustering: group words by vertical center proximity.
// Output: array of rows; tiap row = array of words (sudah sort left-to-right).
function groupWordsIntoRows(words, baseThreshold = ROW_Y_THRESHOLD_PX) {
  if (!words || words.length === 0) return [];

  const valid = words.filter(
    (w) =>
      w &&
      w.bbox &&
      typeof w.bbox.y0 === "number" &&
      typeof w.bbox.y1 === "number" &&
      String(w.text || "").trim().length > 0
  );
  if (valid.length === 0) return [];

  const yCenter = (w) => (w.bbox.y0 + w.bbox.y1) / 2;
  const hOf = (w) => w.bbox.y1 - w.bbox.y0;

  // Adaptive threshold: 0.4 × median height (atau baseThreshold, mana lebih besar).
  // Untuk scan resolusi tinggi (font ~30px), threshold naik ke ~12px;
  // untuk scan low-res (font ~20px), tetap di baseThreshold (15px).
  const heights = valid.map(hOf).sort((a, b) => a - b);
  const medianH = heights[Math.floor(heights.length / 2)] || 20;
  const yThr = Math.max(baseThreshold, medianH * 0.4);

  const sorted = [...valid].sort((a, b) => yCenter(a) - yCenter(b));
  const rows = [];
  let curr = [sorted[0]];
  let currYC = yCenter(sorted[0]);

  for (let i = 1; i < sorted.length; i++) {
    const w = sorted[i];
    const wc = yCenter(w);
    if (Math.abs(wc - currYC) <= yThr) {
      curr.push(w);
      // Running average untuk row center supaya tidak drift
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

// X-zone filter: word masuk zone kalau X-CENTER dalam [xMinFrac, xMaxFrac].
function wordsInZone(rowWords, xMinFrac, xMaxFrac, imageWidth) {
  return rowWords.filter((w) => {
    const xc = (w.bbox.x0 + w.bbox.x1) / 2;
    const xcFrac = xc / imageWidth;
    return xcFrac >= xMinFrac && xcFrac < xMaxFrac;
  });
}

function joinWordTexts(words) {
  return words
    .slice()
    .sort((a, b) => a.bbox.x0 - b.bbox.x0)
    .map((w) => String(w.text || "").trim())
    .filter((t) => t.length > 0)
    .join(" ");
}

// ---- Localized cleansers ----

// CODE: pattern alphanumeric{2-10}-alphanumeric{2-10} (optional 3rd group).
// Buang karakter non [A-Z0-9\s-] dulu agar OCR garbage tidak ngeganggu regex.
function extractItemCodeFromZone(zoneText) {
  if (!zoneText) return null;
  const cleaned = String(zoneText).toUpperCase().replace(/[^A-Z0-9\s-]/g, " ");
  const m = cleaned.match(/\b[A-Z0-9]{2,10}-[A-Z0-9]{2,10}(?:-[A-Z0-9]{2,10})?\b/);
  if (!m) return null;
  const code = m[0];
  if (!/\d/.test(code)) return null; // minimal 1 digit
  if (code.length < 5 || code.length > 22) return null;
  // Tolak >70% huruf (cegah false-positive nama produk yang kebetulan ada dash)
  const letters = (code.match(/[A-Z]/g) || []).length;
  const total = code.replace(/-/g, "").length;
  if (total === 0 || letters / total > 0.7) return null;
  return code;
}

// QTY: tolerant terhadap noise prefix (V/v/centang/asterisk/dll).
// Pattern wajib (user spec): (\d+[,.]?\d*)\s*PCS — di-generalisasi ke
// daftar UNIT_RE_SRC. Indonesian comma decimal ("20,00") → bulatkan ke int.
function extractQtyFromZone(zoneText) {
  if (!zoneText) return { qty: 0, unit: "" };
  const text = String(zoneText);
  // Coba dengan unit eksplisit dulu (paling reliable)
  const withUnit = text.match(
    new RegExp(`(\\d+(?:[,.]\\d+)?)\\s*(${UNIT_RE_SRC})\\b`, "i")
  );
  if (withUnit) {
    const num = parseFloat(withUnit[1].replace(",", "."));
    const qty = Math.round(num);
    if (qty >= 1 && qty <= 9999) {
      return { qty, unit: withUnit[2].toUpperCase() };
    }
  }
  // Fallback: token numerik pertama (anggap qty), kalau wajar (1..9999)
  const m = text.match(/(\d+(?:[,.]\d+)?)/);
  if (!m) return { qty: 0, unit: "" };
  const num = parseFloat(m[1].replace(",", "."));
  const qty = Math.round(num);
  if (qty < 1 || qty > 9999) return { qty: 0, unit: "" };
  return { qty, unit: "" };
}

// PRICE: zone-localized — buang huruf, deteksi format ribuan terpisah-spasi,
// drop trailing 2-digit cents bila ada, fallback largest numeric block.
function extractPriceFromZone(zoneText) {
  if (!zoneText) return 0;
  // Buang alphabetical (user spec: "ignore alphabetical characters completely")
  const noAlpha = String(zoneText).replace(/[a-zA-Z]/g, "");
  const tokens = noAlpha.match(/\d+/g);
  if (!tokens || tokens.length === 0) return 0;

  // Helper: hapus trailing 2-digit cents kalau cocok pola
  let work = tokens.slice();
  if (
    work.length >= 2 &&
    work[work.length - 1].length === 2 &&
    work.slice(0, -1).some((t) => t.length >= 3)
  ) {
    work = work.slice(0, -1);
  }

  // Pola ribuan terpisah-spasi: first 1-3 digit, sisanya semua exactly 3
  // → concat. Contoh "1 500 000" → 1500000, "150 000" → 150000.
  if (
    work.length >= 2 &&
    work[0].length >= 1 &&
    work[0].length <= 3 &&
    work.slice(1).every((t) => t.length === 3)
  ) {
    const v = parseInt(work.join(""), 10) || 0;
    return v >= 1000 ? v : 0;
  }

  // Single token — parse via parseAmount (handle titik/koma separator).
  if (work.length === 1) {
    // Re-include original token (parseAmount akan handle separator)
    const raw = String(zoneText).match(/[\d.,]+/g);
    if (raw && raw.length) {
      let best = 0;
      for (const r of raw) {
        const v = parseAmount(r);
        if (v > best) best = v;
      }
      return best >= 1000 ? best : 0;
    }
    const v = parseInt(work[0], 10) || 0;
    return v >= 1000 ? v : 0;
  }

  // Fallback: largest numeric block by digit-length
  let largest = work[0];
  for (const t of work) if (t.length > largest.length) largest = t;
  const v = parseInt(largest, 10) || 0;
  return v >= 1000 ? v : 0;
}

// NAME: keep alphanumeric + space + slash/dash/dot, collapse whitespace.
function extractItemNameFromZone(zoneText) {
  if (!zoneText) return "";
  return String(zoneText)
    .replace(/[^a-zA-Z0-9\s/.\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Discount: scan ENTIRE row (bukan zone tertentu) untuk "NN%"
function extractDiscountFromRow(rowText) {
  if (!rowText) return 0;
  const m = String(rowText).match(/(\d{1,2}(?:[.,]\d{1,2})?)\s*%/);
  if (!m) return 0;
  const v = parseFloat(m[1].replace(",", "."));
  return v >= 0 && v <= 100 ? v : 0;
}

// Main word-level entry. Returns array of validated items, in document order.
function parseWordsToRows(data, imageWidth) {
  // Flatten semua words across all lines (bypass line grouping Tesseract)
  const allWords = [];
  for (const ln of data?.lines || []) {
    for (const w of ln.words || []) {
      if (w && w.bbox && String(w.text || "").trim()) {
        allWords.push(w);
      }
    }
  }
  if (allWords.length === 0) return [];

  // Drop hanya word ber-confidence sangat rendah (< 30) supaya bbox-nya
  // tidak mengacaukan row grouping. Confidence per-field di-evaluasi
  // setelahnya di flagLowConfidence (threshold 60 untuk cetak).
  const usable = allWords.filter((w) => (w.confidence || 0) >= 30);

  const rows = groupWordsIntoRows(usable);

  const items = [];
  let transactionIndex = 0;
  let lastTransactionCode = null;

  const avgConf = (arr) =>
    arr.length
      ? Math.round(arr.reduce((s, w) => s + (w.confidence || 0), 0) / arr.length)
      : 0;

  for (const rowWords of rows) {
    const rowText = joinWordTexts(rowWords);

    // Multi-transaksi separator (S1-XXXXXX, variasi misread)
    const trxMatch = rowText.match(/\b(?:S[1lLI|i!]|51)[-\s]?(\d{6,10})\b/);
    if (trxMatch) {
      const code = trxMatch[0];
      if (code !== lastTransactionCode) {
        if (items.length > 0) transactionIndex++;
        lastTransactionCode = code;
      }
      continue;
    }

    // Pre-filter: cheap dropouts (header/decorative). Code-zone check
    // di bawah akan tetap nge-drop sisanya; ini cuma optimization.
    if (rowText.length < 6) continue;
    if (SKIP_LINE_RE.test(rowText)) continue;
    if (isDecorativeLine(rowText)) continue;

    // X-zone isolation
    const codeWords = wordsInZone(rowWords, ZONE_CODE_MIN, ZONE_CODE_MAX, imageWidth);
    const nameWords = wordsInZone(rowWords, ZONE_NAME_MIN, ZONE_NAME_MAX, imageWidth);
    const qtyWords = wordsInZone(rowWords, ZONE_QTY_MIN, ZONE_QTY_MAX, imageWidth);
    const priceWords = wordsInZone(
      rowWords,
      ZONE_PRICE_MIN,
      ZONE_PRICE_MAX,
      imageWidth
    );

    // CODE — coba zone strict dulu, lalu safety net: seluruh half kiri
    let kode_barang = extractItemCodeFromZone(joinWordTexts(codeWords));
    if (!kode_barang) {
      const leftHalf = wordsInZone(rowWords, 0, 0.50, imageWidth);
      kode_barang = extractItemCodeFromZone(joinWordTexts(leftHalf));
    }
    // ROW VALIDATION (1): code wajib → drop kalau tidak ada
    if (!kode_barang) continue;

    // PRICE — coba zone strict dulu, lalu fallback ke seluruh half kanan
    let harga_beli = extractPriceFromZone(joinWordTexts(priceWords));
    if (harga_beli < 1000) {
      // Coba right half exclusive qty zone (supaya qty integer kecil tidak
      // ke-pick-up sebagai harga)
      const rightFallback = wordsInZone(rowWords, ZONE_QTY_MAX, 1.0, imageWidth);
      if (rightFallback.length > 0) {
        harga_beli = extractPriceFromZone(joinWordTexts(rightFallback));
      }
    }
    if (harga_beli < 1000) {
      // Last resort: full right half (mulai dari mid)
      const wideRight = wordsInZone(rowWords, 0.50, 1.0, imageWidth);
      const exclQty = wideRight.filter((w) => !qtyWords.includes(w));
      harga_beli = extractPriceFromZone(joinWordTexts(exclQty));
    }
    // ROW VALIDATION (2): price wajib ≥ 1000 → drop kalau tidak ada
    if (harga_beli < 1000) continue;

    // QTY (boleh kosong; bukan validation gate)
    const { qty, unit } = extractQtyFromZone(joinWordTexts(qtyWords));

    // NAME — zone strict, fallback ke "antara kode dan harga" by X
    let nama_barang = extractItemNameFromZone(joinWordTexts(nameWords));
    if (!nama_barang || nama_barang.length < 3) {
      const codeMaxX = codeWords.length
        ? Math.max(...codeWords.map((w) => w.bbox.x1))
        : imageWidth * ZONE_CODE_MAX;
      const priceMinX = priceWords.length
        ? Math.min(...priceWords.map((w) => w.bbox.x0))
        : imageWidth * ZONE_PRICE_MIN;
      const between = rowWords.filter(
        (w) => w.bbox.x0 > codeMaxX && w.bbox.x1 < priceMinX
      );
      nama_barang = extractItemNameFromZone(joinWordTexts(between));
    }
    if (!nama_barang) nama_barang = "(tidak terbaca)";

    // DISCOUNT — scan whole-row (bukan zone)
    const diskon_persen = extractDiscountFromRow(rowText);

    items.push({
      raw: {
        kode_barang,
        nama_barang,
        qty: qty || 0,
        harga_beli,
        diskon_persen,
      },
      confidence: {
        kode_barang: avgConf(codeWords),
        nama_barang: avgConf(nameWords),
        qty: avgConf(qtyWords),
        harga_beli: avgConf(priceWords),
        diskon_persen: 0,
      },
      line_text: rowText,
      transaction_index: transactionIndex,
      transaction_code: lastTransactionCode,
      spatial: {
        image_width: imageWidth,
        unit_detected: unit || null,
        n_code_words: codeWords.length,
        n_name_words: nameWords.length,
        n_qty_words: qtyWords.length,
        n_price_words: priceWords.length,
      },
    });
  }
  return items;
}

// ---------- 4b. TEXT-ONLY parser (FALLBACK — PDF text-layer / no bbox) ------
// Dipakai saat data tidak punya word-level bbox (PDF "lahir digital" yang
// di-extract via pdf-parse, atau worker Tesseract yang tidak balas struktur
// words). Tetap menerapkan STRICT ANCHOR (wajib ada kode barang valid),
// tapi tanpa spatial disambiguation — pakai heuristik regex saja.
function parseLineToItemTextOnly(line) {
  const text = (line.text || "").trim();
  if (text.length < 6) return null;
  if (SKIP_LINE_RE.test(text)) return null;
  if (TRANSACTION_HEADER_RE.test(text)) return null;
  if (isDecorativeLine(text)) return null;
  if (!/[a-zA-Z]/.test(text)) return null;

  // STRICT ANCHOR: kode wajib
  let kode_barang = "";
  const tokens = text.toUpperCase().match(/\b[A-Z0-9]+(?:-[A-Z0-9]+)+\b/g) || [];
  for (const t of tokens) {
    if (isValidItemCode(t)) {
      kode_barang = t;
      break;
    }
  }
  if (!kode_barang) return null; // ← ANCHOR FAIL

  // Qty: angka + satuan, atau keyword qty/jml, atau "X x ..."
  const qtyMatch =
    text.match(
      new RegExp(`\\b(\\d{1,4})(?:[.,]\\d+)?\\s*(?:${UNIT_RE_SRC})\\b`, "i")
    ) ||
    text.match(/(?:qty|jml|jumlah|jum|banyak)\s*[:.]?\s*(\d{1,4})/i) ||
    text.match(/\b(\d{1,4})\s*x\s/i);
  const qtyRaw = qtyMatch ? parseInt(qtyMatch[1], 10) : null;
  const qty = qtyRaw && qtyRaw <= 9999 ? qtyRaw : 0;

  // Harga: Rp/IDR prefix, atau angka berseparator ribuan (median dari semua)
  let harga_beli = 0;
  let hargaMatch = text.match(/(?:rp\.?|idr)\s*([\d.,]+)/i);
  if (hargaMatch) {
    harga_beli = parseAmount(hargaMatch[1]);
  } else {
    const tDot = text.match(/\b\d{1,3}(?:[.,]\d{3}){1,3}(?:[.,]\d{2})?\b/g) || [];
    const tSpace = text.match(/\b\d{1,3}(?:\s+\d{3}){1,3}\b/g) || [];
    const vals = [...tDot, ...tSpace]
      .map((t) => parseAmount(t.replace(/\s+/g, ".")))
      .filter((v) => v >= 1000);
    if (vals.length) {
      vals.sort((a, b) => a - b);
      harga_beli =
        vals.length >= 3 ? vals[Math.floor(vals.length / 2)] : vals[0];
      hargaMatch = { 0: [...tDot, ...tSpace][0] || "" };
    }
  }

  // Diskon
  const diskMatch = text.match(/(\d{1,2}(?:[.,]\d{1,2})?)\s*%/);
  const diskon_persen = diskMatch
    ? parseFloat(String(diskMatch[1]).replace(",", ".")) || 0
    : 0;

  // Nama barang: leftover setelah strip semua field
  let leftover = text;
  if (qtyMatch) leftover = leftover.replace(qtyMatch[0], " ");
  leftover = leftover
    .replace(/(?:rp\.?|idr)\s*[\d.,]+/gi, " ")
    .replace(/\b\d{1,3}(?:[.,]\d{3}){1,3}(?:[.,]\d{2})?\b/g, " ");
  if (diskMatch) leftover = leftover.replace(diskMatch[0], " ");
  leftover = leftover.replace(kode_barang, " ");
  const nama_barang = leftover
    .replace(/[^a-zA-Z0-9\s/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!nama_barang || nama_barang.length < 3) return null;

  // Confidence: pakai overall confidence dari line (text-only tidak punya
  // word-level). avgConfidenceOfWords akan fallback ke 0 kalau words kosong.
  const words = line.words || [];
  const overall = avgConfidenceOfWords(words);
  const confidence = {
    kode_barang: overall,
    nama_barang: overall,
    qty: overall,
    harga_beli: overall,
    diskon_persen: overall,
  };

  return {
    raw: {
      kode_barang,
      nama_barang,
      qty,
      harga_beli,
      diskon_persen,
    },
    confidence,
    line_text: text,
  };
}

// Hitung lebar gambar dari word bboxes (max x1 across all words).
// Dipakai untuk normalisasi zona spatial (kanan/tengah/kiri).
function inferImageWidth(lines) {
  let maxX = 0;
  for (const ln of lines || []) {
    for (const w of ln.words || []) {
      if (w.bbox && typeof w.bbox.x1 === "number" && w.bbox.x1 > maxX) {
        maxX = w.bbox.x1;
      }
    }
  }
  return maxX;
}

function parseTesseractData(data) {
  let lines = data?.lines || [];
  const overallConf = typeof data?.confidence === "number" ? data.confidence : 0;

  // Routing:
  //   - Kalau ada bbox di word-level → WORD-LEVEL SPATIAL (parseWordsToRows).
  //     Y-axis grouping bypass Tesseract line grouping → robust ke dot-matrix
  //     yang baris-barisnya rapat / qty-mishooked-to-next-row.
  //   - Kalau bbox tidak ada (PDF text-layer atau worker tanpa words) →
  //     TEXT-ONLY (parseLineToItemTextOnly) yang tetap pasang strict code
  //     anchor.
  const imageWidth = inferImageWidth(lines);
  const useSpatial = imageWidth > 0 && lines.length > 0;

  if (useSpatial) {
    const items = parseWordsToRows(data, imageWidth);
    // Annotate overall confidence sebagai cadangan kalau word-level kosong
    if (overallConf > 0) {
      for (const it of items) {
        const allZero = Object.values(it.confidence).every((v) => v === 0);
        if (allZero) {
          it.confidence = {
            kode_barang: overallConf,
            nama_barang: overallConf,
            qty: overallConf,
            harga_beli: overallConf,
            diskon_persen: overallConf,
          };
        }
      }
    }
    return items;
  }

  // TEXT-ONLY fallback (PDF digital-born). Bangun pseudo-lines dari data.text
  // bila lines kosong, lalu parse via text-only parser (strict anchor wajib).
  if (lines.length === 0 && typeof data?.text === "string" && data.text.trim()) {
    lines = data.text
      .split(/\r?\n/)
      .map((t) => ({
        text: t,
        words: t.trim() ? [{ text: t, confidence: overallConf }] : [],
      }))
      .filter((l) => l.text.trim().length > 0);
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
      const allZero = Object.values(item.confidence).every((v) => v === 0);
      if (allZero && overallConf > 0) {
        item.confidence = {
          kode_barang: overallConf,
          nama_barang: overallConf,
          qty: overallConf,
          harga_beli: overallConf,
          diskon_persen: overallConf,
        };
      }
      item.transaction_index = transactionIndex;
      item.transaction_code = lastTransactionCode || null;
      items.push(item);
    }
  }
  return items;
}

// ---------- 5. Strategi 3: filter confidence ambang (jalur cetak: 60) ----------
// Item di-flag low_confidence = true kalau rata-rata confidence < 60.
function flagLowConfidence(items, threshold = 60) {
  return items.map((item) => {
    const fields = item.confidence;
    const vals = Object.values(fields).filter((v) => v > 0);
    const avg = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
    return {
      ...item,
      confidence_avg: Math.round(avg),
      low_confidence: avg < threshold,
    };
  });
}

// ---------- 6a. Entry point CETAK (multi-strategy + multi-PSM) ----------
//
// Strategi pipeline (dipilih otomatis):
//   - Kalau kertas berwarna terdeteksi (mean_R - mean_B > 18 dst.) →
//     pipeline 'colored' (extractChannel → Otsu) sebagai pass 1.
//   - Kalau tidak → pipeline 'gentle' standar.
//   - Selalu coba pipeline 'aggressive' (Otsu global pada grayscale)
//     sebagai fallback bila pass 1 hasil ≤ 1 item.
//
// Untuk tiap pipeline, jalankan tesseract dengan 2 PSM (6 = single block,
// 4 = variable column / multi-column tabular). PSM 4 sering lebih bagus
// untuk nota dengan tabel rapat. Pilih PSM yang menghasilkan item terbanyak.
//
// Skor kualitas: items yang ada minimal kode_barang ATAU dua field numerik
// dihitung sebagai "valid". Pipeline+PSM dengan jumlah valid terbanyak menang.
function countValidItems(items) {
  if (!items) return 0;
  let valid = 0;
  for (const it of items) {
    const r = it.raw || {};
    const hasKode = r.kode_barang && String(r.kode_barang).length >= 5;
    const numericCount =
      (r.qty > 0 ? 1 : 0) + (r.harga_beli > 0 ? 1 : 0);
    if (hasKode || numericCount >= 2) valid++;
  }
  return valid;
}

async function recognizeWithPsm(worker, processedBuffer, psm) {
  await worker.setParameters({
    tessedit_pageseg_mode: String(psm),
    preserve_interword_spaces: "1",
  });
  const { data } = await worker.recognize(processedBuffer);
  return data;
}

async function tryPipelineMultiPsm(worker, processedBuffer, label) {
  let best = { data: null, items: [], psm: 6, valid: -1 };
  for (const psm of [6, 4]) {
    const data = await recognizeWithPsm(worker, processedBuffer, psm);
    const items = flagLowConfidence(parseTesseractData(data), 60);
    const valid = countValidItems(items);
    console.log(
      `[POS-OCR] ${label} PSM=${psm} → ${items.length} item (${valid} valid)`
    );
    if (valid > best.valid || (valid === best.valid && items.length > best.items.length)) {
      best = { data, items, psm, valid };
    }
  }
  return best;
}

async function recognizePrintedReceipt(inputBuffer) {
  const worker = await getWorker();

  // Deteksi warna kertas dulu — ini yang menentukan pipeline default.
  const color = await detectPaperColor(inputBuffer);
  console.log(
    `[POS-OCR] Paper color: R=${color.mean_r} G=${color.mean_g} B=${color.mean_b} colored=${color.is_colored} ch=${color.dominant_channel}`
  );

  let chosen = null;
  let pipelineUsed = "";
  let otsuValue = null;
  let metaWidth = 0;
  let metaHeight = 0;
  let upscaledTo = 0;

  if (color.is_colored) {
    // Kertas berwarna — pipeline colored channel sebagai utama
    const colored = await preprocessPrintedColored(inputBuffer, color.dominant_channel);
    const result = await tryPipelineMultiPsm(
      worker,
      colored.processed,
      `colored/${colored.channel}`
    );
    chosen = result;
    pipelineUsed = `sharp/printed/colored-${colored.channel}/psm${result.psm}`;
    otsuValue = colored.otsuValue;
    metaWidth = colored.width;
    metaHeight = colored.height;
    upscaledTo = colored.upscaled_to;
  } else {
    // Kertas putih — pipeline gentle dulu
    const gentle = await preprocessPrintedGentle(inputBuffer);
    const result = await tryPipelineMultiPsm(worker, gentle.processed, "gentle");
    chosen = result;
    pipelineUsed = `sharp/printed/gentle/psm${result.psm}`;
    metaWidth = gentle.width;
    metaHeight = gentle.height;
    upscaledTo = gentle.upscaled_to;
  }

  // Fallback: kalau pass utama tidak hasilkan cukup item, coba aggressive Otsu.
  if (chosen.valid <= 1) {
    console.log("[POS-OCR] Pass utama hasil minim → retry aggressive (Otsu global)");
    const aggressive = await preprocessPrintedAggressive(inputBuffer);
    const result = await tryPipelineMultiPsm(worker, aggressive.processed, "aggressive");
    if (result.valid > chosen.valid) {
      chosen = result;
      pipelineUsed = `sharp/printed/aggressive/psm${result.psm}`;
      otsuValue = aggressive.otsuValue;
    }
  }

  return {
    raw_text: chosen.data?.text || "",
    preprocessing: {
      pipeline: pipelineUsed,
      otsu_threshold: otsuValue,
      paper_color: color,
      width: metaWidth,
      height: metaHeight,
      upscaled_to: upscaledTo,
    },
    items: chosen.items,
  };
}

// =================================================================
// JALUR TULISAN TANGAN (opencv4nodejs)
// =================================================================

// Detect baris teks via horizontal projection profile pada binary mask.
// Return array of { yStart, yEnd } untuk setiap baris (band) terdeteksi.
function detectTextLines(binaryMat, cv) {
  // Sum piksel ink per baris
  const height = binaryMat.rows;
  const width = binaryMat.cols;
  const rowSums = new Array(height).fill(0);
  const data = binaryMat.getDataAsArray(); // 2D array
  for (let y = 0; y < height; y++) {
    let s = 0;
    for (let x = 0; x < width; x++) {
      // Setelah adaptiveThreshold + invert: tinta = 255, kertas = 0
      if (data[y][x] > 0) s++;
    }
    rowSums[y] = s;
  }
  // Ambang: 1.5% lebar gambar dianggap "ada teks di baris ini"
  const threshold = Math.max(3, Math.floor(width * 0.015));
  const lines = [];
  let inLine = false;
  let yStart = 0;
  for (let y = 0; y < height; y++) {
    if (rowSums[y] >= threshold) {
      if (!inLine) {
        inLine = true;
        yStart = y;
      }
    } else if (inLine) {
      inLine = false;
      const yEnd = y;
      // Filter band yang terlalu tipis (< 8 px ≈ noise) atau sangat tebal
      if (yEnd - yStart >= 8 && yEnd - yStart <= height * 0.5) {
        lines.push({ yStart, yEnd });
      }
    }
  }
  if (inLine) lines.push({ yStart, yEnd: height });
  return lines;
}

// Hitung skew angle untuk satu line region via minAreaRect dari kontur.
// Range: -15..+15 deg, fallback 0 jika tidak ada kontur signifikan.
function estimateLineSkew(lineMat, cv) {
  // Find contours pada binary line region
  const contours = lineMat.findContours(
    cv.RETR_EXTERNAL,
    cv.CHAIN_APPROX_SIMPLE
  );
  if (!contours || contours.length === 0) return 0;
  // Ambil contour terbesar (asumsikan merepresentasikan blok teks)
  let largest = contours[0];
  for (const c of contours) {
    if (c.area > largest.area) largest = c;
  }
  if (largest.area < 50) return 0;
  const rect = largest.minAreaRect();
  let angle = rect.angle;
  // OpenCV minAreaRect angle convention: -90..0
  if (angle < -45) angle += 90;
  // Clamp ekstrim
  if (angle < -15) angle = -15;
  if (angle > 15) angle = 15;
  return angle;
}

// Rotate satu line region by `angle` derajat lalu paste-back ke canvas baru.
function deskewPerLineMat(binaryMat, cv) {
  const lines = detectTextLines(binaryMat, cv);
  if (lines.length === 0) return binaryMat;

  const height = binaryMat.rows;
  const width = binaryMat.cols;
  // Canvas hitam (background = 0 setelah pipeline kita = kertas)
  const out = new cv.Mat(height, width, cv.CV_8UC1, [0]);

  for (const ln of lines) {
    // Tambah padding atas/bawah supaya rotasi tidak crop teks
    const pad = Math.min(8, ln.yStart, height - ln.yEnd);
    const y0 = ln.yStart - pad;
    const y1 = ln.yEnd + pad;
    const region = binaryMat.getRegion(new cv.Rect(0, y0, width, y1 - y0));
    const angle = estimateLineSkew(region.copy(), cv);
    let rotated;
    if (Math.abs(angle) < 0.5) {
      rotated = region.copy();
    } else {
      const center = new cv.Point2(width / 2, (y1 - y0) / 2);
      const M = cv.getRotationMatrix2D(center, angle, 1.0);
      rotated = region.warpAffine(
        M,
        new cv.Size(width, y1 - y0),
        cv.INTER_LINEAR,
        cv.BORDER_CONSTANT,
        new cv.Vec(0, 0, 0)
      );
    }
    // Paste-back via copyTo
    rotated.copyTo(out.getRegion(new cv.Rect(0, y0, width, y1 - y0)));
  }
  return out;
}

// Pipeline preprocessing utama untuk tulisan tangan.
async function preprocessHandwritten(inputBuffer) {
  const cv = getCv(); // throw OCV_NOT_AVAILABLE jika modul tidak ada

  // Pre-rotate via sharp untuk hormati EXIF orientation (foto kamera HP),
  // re-encode jadi PNG buffer baru → opencv decode.
  const orientedBuffer = await sharp(inputBuffer).rotate().toBuffer();

  // Decode buffer → Mat. opencv4nodejs.imdecode menerima Buffer.
  let src = cv.imdecode(orientedBuffer);
  if (!src || src.empty) {
    throw new Error("Gagal decode gambar dengan opencv4nodejs");
  }

  // (1) Grayscale
  const gray =
    src.channels === 1 ? src : src.cvtColor(cv.COLOR_BGR2GRAY);

  // (2) Adaptive threshold (Gaussian, blockSize=11, C=2). Hasil: tinta=255, kertas=0.
  // Pakai THRESH_BINARY_INV agar tinta jadi foreground (untuk dilatasi & contour).
  const adaptive = gray.adaptiveThreshold(
    255,
    cv.ADAPTIVE_THRESH_GAUSSIAN_C,
    cv.THRESH_BINARY_INV,
    11,
    2
  );

  // (3) Bilateral filter — perlu input grayscale 1ch (bukan binary), supaya
  // edge-preserving smoothing efektif. Kita filter `gray`, hasilnya kita
  // re-threshold via adaptive lagi. (Pendekatan: smooth dulu, threshold di akhir
  // untuk hasil lebih bersih daripada filter di binary.)
  const smoothed = gray.bilateralFilter(9, 75, 75);
  const adaptive2 = smoothed.adaptiveThreshold(
    255,
    cv.ADAPTIVE_THRESH_GAUSSIAN_C,
    cv.THRESH_BINARY_INV,
    11,
    2
  );

  // (4) Deskew per-baris
  const deskewed = deskewPerLineMat(adaptive2, cv);

  // (5) Dilatasi morfologis ringan, kernel 2x2, 1 iterasi
  const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(2, 2));
  const dilated = deskewed.dilate(kernel, new cv.Point2(-1, -1), 1);

  // Tesseract butuh tinta gelap di latar terang → invert kembali.
  const finalBin = dilated.bitwiseNot();

  // Encode ke PNG buffer untuk diteruskan ke worker.
  const pngBuffer = cv.imencode(".png", finalBin);

  return {
    processed: pngBuffer,
    width: src.cols,
    height: src.rows,
    n_lines_detected: detectTextLines(adaptive2, cv).length,
  };
}

// ---------- 6b. Entry point TULISAN TANGAN ----------
async function recognizeHandwrittenReceipt(inputBuffer) {
  const { processed, width, height, n_lines_detected } =
    await preprocessHandwritten(inputBuffer);

  const worker = await getWorker();
  // Reset PSM ke 6 — pipeline printed multi-PSM bisa meninggalkan PSM=4
  // di worker shared. Tulisan tangan paling cocok dengan PSM 6 (single block).
  await worker.setParameters({
    tessedit_pageseg_mode: "6",
    preserve_interword_spaces: "1",
  });
  const { data } = await worker.recognize(processed);
  const rawText = data.text || "";

  let items = parseTesseractData(data);
  items = flagLowConfidence(items, 45); // Strategi 3: ambang tulisan tangan

  return {
    raw_text: rawText,
    preprocessing: {
      pipeline: "opencv/handwritten",
      width,
      height,
      n_lines_detected,
    },
    items,
  };
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
