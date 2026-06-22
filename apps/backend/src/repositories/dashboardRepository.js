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
    (acc, s) => acc + Number(s.total_harga || 0), 0
  );

  // (2) Gross Profit = Σ max(0, (harga_jual − harga_beli) × qty) dalam periode
  const { data: itemsData, error: gpErr } = await supabase
    .from("sale_items")
    .select("qty, subtotal, sales!inner(created_at), products!inner(harga_beli)")
    .gte("sales.created_at", startDate)
    .lte("sales.created_at", endDate);
  if (gpErr) throw new Error("Gagal memuat data gross profit");

  // Revenue per baris = subtotal (SUDAH termasuk diskon per item) − HPP (qty × harga_beli).
  // Catatan: HPP masih pakai products.harga_beli terkini (snapshot HPP = item H4).
  const gross_profit = (itemsData || []).reduce((acc, it) => {
    const cost = Number(it.products?.harga_beli || 0) * Number(it.qty || 0);
    return acc + Math.max(0, Number(it.subtotal || 0) - cost);
  }, 0);

  // (3) R1 REJECTED hari ini (selalu today — bukti R1 aktif)
  const { count: r1_rejected_today, error: r1Err } = await supabase
    .from("stock_logs")
    .select("id", { count: "exact", head: true })
    .eq("rule_triggered", "R1")
    .eq("rule_action", "REJECTED")
    .gte("created_at", todayStart)
    .lte("created_at", todayEnd);
  if (r1Err) throw new Error("Gagal memuat R1 rejected hari ini");

  // (4) Stok dari v_restock_recommendation — konsisten dengan halaman Restock (R5)
  const { data: restockData, error: restockErr } = await supabase
    .from("v_restock_recommendation")
    .select("tingkat_urgensi");
  if (restockErr) throw new Error("Gagal memuat data restock");

  const low_stock_count   = (restockData || []).filter((r) => r.tingkat_urgensi === "MENIPIS").length;
  const stok_habis_count  = (restockData || []).filter((r) => r.tingkat_urgensi === "HABIS").length;
  const stok_kritis_count = (restockData || []).filter((r) => r.tingkat_urgensi === "KRITIS").length;

  // (5) Barang "jual rugi": harga_jual sudah di-set TAPI <= harga_beli.
  // Perbandingan antar-kolom tidak didukung query builder → filter di JS.
  // Kondisi state terkini (tidak tergantung periode).
  const { data: priceData, error: priceErr } = await supabase
    .from("products")
    .select("id, kode_barang, nama_barang, merk, harga_beli, harga_jual")
    .eq("status", "aktif");
  if (priceErr) throw new Error("Gagal memuat data harga produk");

  const jual_rugi_items = (priceData || [])
    .filter((p) => Number(p.harga_jual) > 0 && Number(p.harga_jual) <= Number(p.harga_beli))
    .map((p) => ({
      id: p.id,
      kode_barang: p.kode_barang,
      nama_barang: p.nama_barang,
      merk: p.merk,
      harga_beli: Number(p.harga_beli),
      harga_jual: Number(p.harga_jual),
    }))
    // Kerugian terbesar (selisih beli−jual) di urutan teratas.
    .sort((a, b) => (b.harga_beli - b.harga_jual) - (a.harga_beli - a.harga_jual));

  return {
    tx_today_count,
    revenue_today,
    gross_profit,
    r1_rejected_today: r1_rejected_today || 0,
    low_stock_count,
    stok_habis_count,
    stok_kritis_count,
    jual_rugi_count: jual_rugi_items.length,
    jual_rugi_items,
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
    .select("qty, subtotal, sales!inner(created_at), products!inner(harga_beli)")
    .gte("sales.created_at", start);
  if (itemsErr) throw new Error("Gagal memuat item penjualan untuk gross profit");

  for (const it of itemsData || []) {
    const key = new Date(it.sales?.created_at).toISOString().slice(0, 10);
    if (!buckets.has(key)) continue;
    const b = buckets.get(key);
    // Revenue = subtotal (termasuk diskon per item) − HPP (qty × harga_beli).
    const cost = Number(it.products?.harga_beli || 0) * Number(it.qty || 0);
    b.gross_profit += Math.max(0, Number(it.subtotal || 0) - cost);
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

  // Kurangi qty yang DIRETUR pelanggan (sales_return yg sudah approved) dalam
  // periode sama → "produk terlaris" mencerminkan penjualan BERSIH. Non-fatal:
  // bila query gagal, lewati pengurangan (jangan sampai dashboard error).
  try {
    const { data: retData } = await supabase
      .from("stock_adjustment_items")
      .select("product_id, qty, stock_adjustments!inner(type, status, created_at)")
      .eq("stock_adjustments.type", "sales_return")
      .eq("stock_adjustments.status", "approved")
      .gte("stock_adjustments.created_at", start);
    for (const r of retData || []) {
      const e = agg.get(r.product_id);
      if (e) e.total_qty = Math.max(0, e.total_qty - Number(r.qty || 0));
    }
  } catch (_) {
    /* abaikan — tampilkan angka penjualan kotor bila data retur tak terbaca */
  }

  return Array.from(agg.values())
    .sort((a, b) => b.total_qty - a.total_qty)
    .slice(0, limit);
}

module.exports = {
  getSummary,
  getSalesTrend,
  getTopProducts,
};
