// utils/documentCounter.js — Penomoran dokumen sequential dengan reset tahunan.
// Memanggil fn_next_document_number(prefix) di DB yang menjamin atomisitas.
// Format hasil: PREFIX-YYYYMMDD-XXXX (contoh: INV-20260530-0000)

const supabase = require("../config/supabase");

const PREFIX_MAP = {
  sale:             "INV",
  return_supplier:  "RTS",
  sales_return:     "RTP",
  stock_adjustment: "ADJ",
};

async function nextDocumentNumber(typeOrPrefix) {
  const prefix = PREFIX_MAP[typeOrPrefix] || typeOrPrefix;
  const { data, error } = await supabase.rpc("fn_next_document_number", {
    p_prefix: prefix,
  });
  if (error) {
    // Fallback ke pola lama agar transaksi tidak terblokir jika DB error
    console.error(`[POS-DOCNUM] Gagal ambil nomor untuk '${prefix}':`, error.message);
    const now = new Date();
    const d = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const rnd = Math.floor(Math.random() * 0xffffff).toString(16).toUpperCase().padStart(6, "0");
    return `${prefix}-${d}-${rnd}`;
  }
  return data;
}

module.exports = { nextDocumentNumber };
