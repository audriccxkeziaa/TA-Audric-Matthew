// restockRepository.js — Akses view v_restock_recommendation (R5)
// View dibuat di migrasi 007, di-extend di 011 (avg_sales_30d, estimasi_hari_habis).
// ROP dihitung di sini (backend layer) dengan nilai fallback:
//   lead_time = 3 hari (asumsi standar pengiriman supplier)
//   safety_stock = avg_sales_30d × 2 hari (buffer aman)
//   ROP = (avg_sales_30d × lead_time) + safety_stock

const supabase = require("../config/supabase");

const LEAD_TIME_HARI = 3;

function computeRop(row) {
  const avgSales = Number(row.avg_sales_30d || 0);
  if (avgSales === 0) {
    return { rop: 0, lead_time_hari: LEAD_TIME_HARI, safety_stock: 0, dibawah_rop: false };
  }
  const safetyStock = Math.round(avgSales * 2);
  const rop = Math.round(avgSales * LEAD_TIME_HARI + safetyStock);
  return {
    rop,
    lead_time_hari: LEAD_TIME_HARI,
    safety_stock: safetyStock,
    dibawah_rop: Number(row.stok) < rop,
  };
}

async function listRestockRecommendations() {
  const { data, error } = await supabase
    .from("v_restock_recommendation")
    .select(
      "id, kode_barang, nama_barang, merk, stok, min_stock, kekurangan, tingkat_urgensi, harga_beli, harga_jual, status, avg_sales_30d, total_sold_30d, n_transactions_30d, estimasi_hari_habis"
    );

  if (error) {
    console.error("[POS-RESTOCK-REPO] list error:", error.message);
    throw new Error("Gagal memuat rekomendasi restock");
  }
  return (data || []).map((row) => ({ ...row, ...computeRop(row) }));
}

module.exports = { listRestockRecommendations };
