// Helper rentang tanggal & warna heatmap untuk dashboard. Murni, dipindahkan
// apa adanya dari page.jsx.

// Hari ini (ISO, dari 00:00:00 s/d 23:59:59).
export function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { from: start.toISOString(), to: end.toISOString() };
}

// 7 hari terakhir (ISO).
export function last7DaysRange() {
  const start = new Date();
  start.setDate(start.getDate() - 7);
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  return { from: start.toISOString(), to: end.toISOString() };
}

// Warna kotak heatmap sesuai level kekritisan stok.
export function heatColor(level) {
  if (level === "out") return "bg-red-600 text-white";
  if (level === "low") return "bg-amber-500 text-white";
  return "bg-yellow-300 text-slate-800";
}
