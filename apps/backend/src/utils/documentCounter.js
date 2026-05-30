// utils/documentCounter.js — Penomoran dokumen sequential dengan reset tahunan.
// Memanggil fn_next_document_number(prefix) di DB yang menjamin atomisitas.
// Format hasil: PREFIX-YYYYMMDD-XXXX (contoh: INV-20260530-0000)
// Zona waktu: WITA (UTC+8 / Asia/Makassar)

const supabase = require("../config/supabase");

const PREFIX_MAP = {
  sale:             "INV",
  return_supplier:  "RTS",
  sales_return:     "RTP",
  stock_adjustment: "ADJ",
};

function wita8DateStr() {
  // Fallback: hitung tanggal WITA (UTC+8) secara manual
  const now = new Date();
  const wita = new Date(now.getTime() + 8 * 60 * 60 * 1000); // shift ke UTC+8
  const yyyy = wita.getUTCFullYear();
  const mm   = String(wita.getUTCMonth() + 1).padStart(2, "0");
  const dd   = String(wita.getUTCDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

async function nextDocumentNumber(typeOrPrefix) {
  const prefix = PREFIX_MAP[typeOrPrefix] || typeOrPrefix;
  const { data, error } = await supabase.rpc("fn_next_document_number", {
    p_prefix: prefix,
  });
  if (error) {
    console.error(`[POS-DOCNUM] Gagal ambil nomor untuk '${prefix}':`, error.message);
    const rnd = Math.floor(Math.random() * 0xffffff).toString(16).toUpperCase().padStart(6, "0");
    return `${prefix}-${wita8DateStr()}-${rnd}`;
  }
  return data;
}

module.exports = { nextDocumentNumber };
