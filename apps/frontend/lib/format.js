// lib/format.js — Utilitas format tampilan (Bahasa Indonesia)

// Format angka jadi Rupiah: 25000 → "Rp 25.000"
export function rupiah(value) {
  const n = Number(value || 0);
  return "Rp " + n.toLocaleString("id-ID", { maximumFractionDigits: 0 });
}

// Format angka biasa dengan pemisah ribuan: 1500 → "1.500"
export function angka(value) {
  return Number(value || 0).toLocaleString("id-ID");
}

// Format jam saja: "14:30"
export function jam(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

// Format tanggal+jam: "22 Mei 2026, 14:30"
export function tanggalJam(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Format tanggal saja: "22 Mei 2026"
export function tanggal(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Tanggal format YYYY-MM-DD untuk <input type="date"> (hari ini default).
export function isoDate(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

// Persentase similarity Levenshtein: 0.92 → "92%"
export function persen(value) {
  return Math.round(Number(value || 0) * 100) + "%";
}
