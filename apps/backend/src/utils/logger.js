// utils/logger.js — Logger terpusat backend.
//
// Tujuan: saat ada error di area rawan (commit transaksi via RPC, OCR, upload
// file, auth), developer langsung tahu DI MANA dan KENAPA tanpa menebak — output
// terstruktur: timestamp WITA + level + scope + pesan + konteks + stack.
//
// Pemakaian:
//   const log = require("../utils/logger");
//   log.info("SALES", "Transaksi sukses", { kode, total });
//   log.warn("OCR", "Confidence rendah, fallback manual", { quality });
//   log.error("SALES", "Commit gagal", err, { kode_transaksi, items: n });

function ts() {
  return new Date().toLocaleString("id-ID", {
    timeZone: "Asia/Makassar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function head(level, scope) {
  return `[${ts()} WITA] [${level}] [POS-${scope}]`;
}

function info(scope, msg, ctx) {
  if (ctx) console.log(head("INFO", scope), msg, ctx);
  else console.log(head("INFO", scope), msg);
}

function warn(scope, msg, ctx) {
  if (ctx) console.warn(head("WARN", scope), msg, ctx);
  else console.warn(head("WARN", scope), msg);
}

// error: `err` boleh Error atau string. Stack dicetak terpisah agar mudah dibaca.
function error(scope, msg, err, ctx) {
  const detail = {
    error: err?.message || (err != null ? String(err) : "(tanpa pesan)"),
    ...(err?.code ? { code: err.code } : {}),
    ...(ctx ? { context: ctx } : {}),
  };
  console.error(head("ERROR", scope), msg, detail);
  if (err?.stack) console.error(err.stack);
}

module.exports = { info, warn, error };
