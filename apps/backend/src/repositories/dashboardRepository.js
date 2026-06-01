const supabase = require("../config/supabase");

function startOfTodayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
function endOfTodayIso() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}
function daysAgoIso(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

// Summary cards untuk halaman /admin/dashboard.
// from/to opsional (ISO string); default = hari ini.
async function getSummary({ from, to } = {}) {
  const todayStart = startOfTodayIso();
  const todayEnd = endOfTodayIso();
  const startDate = from || todayStart;
  const endDate = to || todayEnd;

  // (1) Jumlah transaksi + revenue dalam periode
  const { data: salesPeriod, error: salesErr } = await supabase
    .from("sales")
    .select("id, total_harga")
    .gte("created_at", startDate)
    .lte("created_at", endDate);
  if (salesErr) throw new Error("Gagal memuat sales periode");

  const tx_today_count = salesPeriod?.length || 0;
  const revenue_today = (salesPeriod || []).reduce(
    (acc, s) => acc + Number(s.total_harga || 0),
    0
  );

  // (2) Pengeluaran operasional (expenses, kolom tanggal = DATE)
  const expFrom = startDate.slice(0, 10);
  const expTo = endDate.slice(0, 10);
  const { data: expRows, error: expErr } = await supabase
    .from("expenses")
    .select("nominal")
    .gte("tanggal", expFrom)
    .lte("tanggal", expTo);
  if (expErr) throw new Error("Gagal memuat pengeluaran operasional");
  const total_operasional = (expRows || []).reduce(
    (a, r) => a + Number(r.nominal || 0), 0
  );

  // (3) Pembelian supplier tervalidasi dalam periode
  const { data: purchRows, error: purchErr } = await supabase
    .from("purchases")
    .select("total")
    .eq("status_validasi", "tervalidasi")
    .gte("created_at", startDate)
    .lte("created_at", endDate);
  if (purchErr) throw new Error("Gagal memuat pembelian supplier");
  const total_pembelian = (purchRows || []).reduce(
    (a, r) => a + Number(r.total || 0), 0
  );

  const total_pengeluaran = total_operasional + total_pembelian;
  const laba_bersih = revenue_today - total_pengeluaran;

  // (4) Jumlah R1 REJECTED hari ini (selalu today — bukti R1 aktif)
  const { count: r1_rejected_today, error: r1Err } = await supabase
    .from("stock_logs")
    .select("id", { count: "exact", head: true })
    .eq("rule_triggered", "R1")
    .eq("rule_action", "REJECTED")
    .gte("created_at", todayStart)
    .lte("created_at", todayEnd);
  if (r1Err) throw new Error("Gagal memuat R1 rejected hari ini");

  // (5) Stok menipis + negatif (selalu kondisi saat ini)
  const { data: lowStockRows, error: lsErr } = await supabase
    .from("products")
    .select("id, stok, min_stock")
    .eq("status", "aktif");
  if (lsErr) throw new Error("Gagal memuat produk aktif");

  const low_stock_count = (lowStockRows || []).filter(
    (p) => Number(p.stok) <= Number(p.min_stock)
  ).length;

  const negative_stock_count = (lowStockRows || []).filter(
    (p) => Number(p.stok) < 0
  ).length;

  return {
    tx_today_count,
    revenue_today,
    laba_bersih,
    total_pengeluaran,
    r1_rejected_today: r1_rejected_today || 0,
    low_stock_count,
    negative_stock_count,
  };
}

// Tren penjualan harian (30 hari terakhir) + gross profit per hari.
// gross_profit = Σ (harga_jual - harga_beli) × qty untuk semua item terjual.
async function getSalesTrend(days = 30) {
  const start = daysAgoIso(days);

  // Buat bucket per tanggal (zona waktu lokal server)
  const buckets = new Map();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, { date: key, tx_count: 0, total_revenue: 0, gross_profit: 0 });
  }

  // (1) Aggregasi tx_count dan total_revenue dari sales
  const { data: salesData, error: salesErr } = await supabase
    .from("sales")
    .select("id, total_harga, created_at")
    .gte("created_at", start)
    .order("created_at", { ascending: true });
  if (salesErr) throw new Error("Gagal memuat tren penjualan");

  for (const s of salesData || []) {
    const key = new Date(s.created_at).toISOString().slice(0, 10);
    if (!buckets.has(key)) continue;
    const b = buckets.get(key);
    b.tx_count += 1;
    b.total_revenue += Number(s.total_harga || 0);
  }

  // (2) Aggregasi gross profit dari sale_items + harga_beli produk
  const { data: itemsData, error: itemsErr } = await supabase
    .from("sale_items")
    .select("qty, harga_satuan, sales!inner(created_at), products!inner(harga_beli)")
    .gte("sales.created_at", start);
  if (itemsErr) throw new Error("Gagal memuat item penjualan untuk gross profit");

  for (const it of itemsData || []) {
    const key = new Date(it.sales?.created_at).toISOString().slice(0, 10);
    if (!buckets.has(key)) continue;
    const b = buckets.get(key);
    const margin = Number(it.harga_satuan || 0) - Number(it.products?.harga_beli || 0);
    b.gross_profit += Math.max(0, margin * Number(it.qty || 0));
  }

  return Array.from(buckets.values());
}

// Top produk terlaris (qty) dalam N hari
async function getTopProducts({ days = 30, limit = 10 }) {
  const start = daysAgoIso(days);

  const { data, error } = await supabase
    .from("sale_items")
    .select(
      "product_id, qty, subtotal, sales!inner(created_at), products!inner(kode_barang, nama_barang, merk)"
    )
    .gte("sales.created_at", start);
  if (error) throw new Error("Gagal memuat top produk");

  const agg = new Map();
  for (const r of data || []) {
    const pid = r.product_id;
    if (!agg.has(pid)) {
      agg.set(pid, {
        product_id: pid,
        kode_barang: r.products?.kode_barang,
        nama_barang: r.products?.nama_barang,
        merk: r.products?.merk,
        total_qty: 0,
        total_revenue: 0,
      });
    }
    const e = agg.get(pid);
    e.total_qty += Number(r.qty || 0);
    e.total_revenue += Number(r.subtotal || 0);
  }

  return Array.from(agg.values())
    .sort((a, b) => b.total_qty - a.total_qty)
    .slice(0, limit);
}

// Heatmap stok menipis: produk yang stok <= min_stock * threshold (default 1.5)
async function getLowStockHeatmap({ thresholdRatio = 1.5 } = {}) {
  const { data, error } = await supabase
    .from("products")
    .select("id, kode_barang, nama_barang, merk, stok, min_stock")
    .eq("status", "aktif")
    .order("stok", { ascending: true });
  if (error) throw new Error("Gagal memuat heatmap stok");

  return (data || [])
    .map((p) => {
      const stok = Number(p.stok);
      const min = Number(p.min_stock);
      const threshold = Math.max(1, Math.ceil(min * thresholdRatio));
      const ratio = min > 0 ? stok / min : stok > 0 ? 999 : 0;
      let level = "normal";
      if (stok === 0) level = "out";
      else if (stok <= min) level = "low";
      else if (stok <= threshold) level = "warning";
      return { ...p, ratio, level, threshold };
    })
    .filter((p) => p.level !== "normal");
}

module.exports = {
  getSummary,
  getSalesTrend,
  getTopProducts,
  getLowStockHeatmap,
};
