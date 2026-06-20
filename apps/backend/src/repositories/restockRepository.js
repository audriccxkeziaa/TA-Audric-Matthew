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
  const stok = Number(row.stok || 0);
  if (avgSales === 0) {
    // Belum ada penjualan 30 hari → ROP tak bisa dihitung dari laju jual.
    // Tetapi stok yang sudah habis tidak boleh dianggap "Aman".
    return { rop: 0, lead_time_hari: LEAD_TIME_HARI, safety_stock: 0, dibawah_rop: stok <= 0 };
  }
  // Pakai ceil + minimal 1: barang slow-mover (laju < 1/hari) jangan sampai
  // ROP-nya membulat ke 0 sehingga stok habis salah dikira "Aman".
  const safetyStock = Math.ceil(avgSales * 2);
  const rop = Math.max(1, Math.ceil(avgSales * LEAD_TIME_HARI + safetyStock));
  return {
    rop,
    lead_time_hari: LEAD_TIME_HARI,
    safety_stock: safetyStock,
    // <= : begitu stok menyentuh ROP sudah harus pesan (termasuk stok 0).
    dibawah_rop: stok <= rop,
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
