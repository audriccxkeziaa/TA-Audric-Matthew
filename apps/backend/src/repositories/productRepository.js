const supabase = require("../config/supabase");

// Ambil banyak produk berdasarkan id (untuk R1 pre-check di salesService)
async function findByIds(ids) {
  const { data, error } = await supabase
    .from("products")
    .select("id, kode_barang, nama_barang, merk, harga_jual, stok, status")
    .in("id", ids);

  if (error) {
    console.error("[POS-PRODREPO] findByIds error:", error.message);
    throw new Error("Gagal memuat produk");
  }
  return data || [];
}

// Ambil satu produk berdasarkan id
async function findById(id) {
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, kode_barang, nama_barang, merk, harga_beli, harga_jual, stok, min_stock, status, created_at, updated_at"
    )
    .eq("id", id)
    .single();
  if (error) {
    if (error.code === "PGRST116") return null; // not found
    console.error("[POS-PRODREPO] findById error:", error.message);
    throw new Error("Gagal memuat produk");
  }
  return data;
}

// Cek kode_barang unique (untuk POST / PATCH)
async function existsByKodeBarang(kodeBarang, excludeId = null) {
  let query = supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("kode_barang", kodeBarang);
  if (excludeId) query = query.neq("id", excludeId);
  const { count, error } = await query;
  if (error) {
    console.error("[POS-PRODREPO] existsByKodeBarang error:", error.message);
    throw new Error("Gagal cek kode barang");
  }
  return (count || 0) > 0;
}

// Pencarian produk untuk halaman /kasir & /master-barang
// q: search term, status: 'aktif'|'nonaktif'|null, stockFilter: 'low'|'out'|'normal'|null
// page: nomor halaman (1-based), limit: per halaman
async function listDistinctMerks() {
  const { data, error } = await supabase
    .from("products")
    .select("merk")
    .not("merk", "is", null)
    .order("merk", { ascending: true });
  if (error) {
    console.error("[POS-PRODREPO] listDistinctMerks error:", error.message);
    return [];
  }
  const unique = [...new Set((data || []).map((r) => r.merk).filter(Boolean))];
  return unique;
}

async function search({ q = "", status = null, stockFilter = null, merk = null, limit = 20, page = 1 }) {
  const offset = (Math.max(1, page) - 1) * limit;

  let query = supabase
    .from("products")
    .select(
      "id, kode_barang, nama_barang, merk, harga_beli, harga_jual, stok, min_stock, status, created_at, updated_at",
      { count: "exact" }
    )
    .order("nama_barang", { ascending: true })
    .range(offset, offset + limit - 1);

  if (status === "aktif" || status === "nonaktif") {
    query = query.eq("status", status);
  } else if (status !== "all") {
    // "all" = tampilkan semua status; undefined/null/lain = default aktif
    query = query.eq("status", "aktif");
  }

  if (q && q.trim()) {
    const term = q.trim();
    const termNorm = term.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    query = query.or(
      `nama_barang.ilike.%${term}%,kode_barang.ilike.%${term}%,kode_normalized.ilike.${termNorm}%`
    );
  }

  if (merk) {
    query = query.eq("merk", merk);
  }

  const { data, error, count } = await query;
  if (error) {
    console.error("[POS-PRODREPO] search error:", error.message);
    throw new Error("Gagal mencari produk");
  }

  let result = data || [];
  if (stockFilter === "out") {
    result = result.filter((p) => p.stok === 0);
  } else if (stockFilter === "low") {
    result = result.filter((p) => p.stok > 0 && p.stok <= p.min_stock);
  } else if (stockFilter === "normal") {
    result = result.filter((p) => p.stok > p.min_stock);
  }
  return { rows: result, total: count || 0, page, limit, total_pages: Math.max(1, Math.ceil((count || 0) / limit)) };
}

// INSERT produk baru. Stok awal selalu 0 — penambahan stok WAJIB lewat alur
// stok masuk (R3/R4) supaya teraudit di stock_logs.
async function create({
  kode_barang,
  nama_barang,
  merk = null,
  harga_beli = 0,
  harga_jual = 0,
  min_stock = 5,
  status = "aktif",
}) {
  const { data, error } = await supabase
    .from("products")
    .insert({
      kode_barang,
      nama_barang,
      merk,
      harga_beli,
      harga_jual,
      stok: 0,
      min_stock,
      status,
    })
    .select(
      "id, kode_barang, nama_barang, merk, harga_beli, harga_jual, stok, min_stock, status, created_at, updated_at"
    )
    .single();

  if (error) {
    console.error("[POS-PRODREPO] create error:", error.message);
    if (error.code === "23505") throw new Error("Kode barang sudah dipakai");
    throw new Error("Gagal menyimpan produk");
  }
  return data;
}

// UPDATE produk. Field `stok` TIDAK BOLEH masuk patch — akan di-blok caller.
// Trigger R3 di DB pun akan menolak jika ada UPDATE pada kolom stok.
async function update(id, patch) {
  const { data, error } = await supabase
    .from("products")
    .update(patch)
    .eq("id", id)
    .select(
      "id, kode_barang, nama_barang, merk, harga_beli, harga_jual, stok, min_stock, status, created_at, updated_at"
    )
    .single();
  if (error) {
    console.error("[POS-PRODREPO] update error:", error.message);
    if (error.code === "23505") throw new Error("Kode barang sudah dipakai");
    if (error.code === "45R03") {
      const e = new Error(
        "R3: Stok tidak boleh diubah manual. Gunakan transaksi penjualan atau stok masuk."
      );
      e.rule = "R3";
      throw e;
    }
    throw new Error("Gagal mengupdate produk");
  }
  return data;
}

// Ambil SELURUH produk untuk katalog Browse kasir (slim fields, termasuk
// nonaktif). Paginasi internal menembus batas max-rows Supabase (default
// ~1000/permintaan) supaya semua barang (ribuan) benar-benar terambil.
async function getCatalog() {
  const PAGE = 1000;
  let all = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("products")
      .select("id, kode_barang, nama_barang, merk, harga_beli, harga_jual, stok, status")
      .order("nama_barang", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) {
      console.error("[POS-PRODREPO] getCatalog error:", error.message);
      throw new Error("Gagal memuat katalog produk");
    }
    all = all.concat(data || []);
    if (!data || data.length < PAGE) break;
  }
  return all;
}

module.exports = {
  findByIds,
  findById,
  existsByKodeBarang,
  listDistinctMerks,
  search,
  getCatalog,
  create,
  update,
};
