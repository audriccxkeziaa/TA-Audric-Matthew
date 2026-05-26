const supabase = require("../config/supabase");

// Panggil function plpgsql fn_create_sale (lihat migrasi 008).
// Function ini berjalan dalam SATU transaksi: jika trigger R1/R3 RAISE EXCEPTION,
// seluruh INSERT di-ROLLBACK otomatis.
async function createSaleViaRpc({ userId, kodeTransaksi, items }) {
  const { data, error } = await supabase.rpc("fn_create_sale", {
    p_user_id: userId,
    p_kode_transaksi: kodeTransaksi,
    p_items: items,
  });

  if (error) {
    // Lempar object berisi metadata SQLSTATE supaya service layer bisa map ke HTTP code
    const err = new Error(error.message);
    err.code = error.code;
    err.details = error.details;
    err.hint = error.hint;
    throw err;
  }
  return data;
}

async function getReceipt(saleId) {
  // Fetch sale header WITHOUT the join first
  const { data: sale, error: saleErr } = await supabase
    .from("sales")
    .select("id, kode_transaksi, user_id, total_harga, diskon_persen, potongan_harga, created_at")
    .eq("id", saleId)
    .single();
  if (saleErr) throw new Error("Gagal memuat header transaksi");

  // Fetch user separately if user_id exists
  let kasir = null;
  if (sale.user_id) {
    const { data: user } = await supabase
      .from("users")
      .select("username")
      .eq("id", sale.user_id)
      .single();
    kasir = user?.username || null;
  }

  // Fetch items
  const { data: items, error: itemsErr } = await supabase
    .from("sale_items")
    .select(
      "id, product_id, qty, harga_satuan, diskon_persen, subtotal, products(kode_barang, nama_barang, merk)"
    )
    .eq("sale_id", saleId)
    .order("created_at", { ascending: true });
  if (itemsErr) throw new Error("Gagal memuat detail transaksi");

  return {
    ...sale,
    kasir,
    items: items.map((it) => ({
      id: it.id,
      product_id: it.product_id,
      kode_barang: it.products?.kode_barang,
      nama_barang: it.products?.nama_barang,
      merk: it.products?.merk,
      qty: it.qty,
      harga_satuan: Number(it.harga_satuan),
      diskon_persen: Number(it.diskon_persen || 0),
      subtotal: Number(it.subtotal),
    })),
  };
}

// Listing untuk GET /api/sales
async function list({ from, to, limit = 50 }) {
  let query = supabase
    .from("sales")
    .select("id, kode_transaksi, user_id, total_harga, created_at, users(username), sale_items(id)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);

  const { data, error } = await query;
  if (error) throw new Error("Gagal memuat daftar transaksi");

  // Fetch users secara terpisah untuk setiap unique user_id
  const userIds = [...new Set((data || []).map(r => r.user_id).filter(Boolean))];
  let userMap = new Map();

  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from("users")
      .select("id, username")
      .in("id", userIds);
    userMap = new Map(users?.map(u => [u.id, u.username]) || []);
  }

  return (data || []).map((r) => ({
    id: r.id,
    kode_transaksi: r.kode_transaksi,
    user_id: r.user_id,
    total_harga: r.total_harga,
    created_at: r.created_at,
    kasir: userMap.get(r.user_id) || null,
    item_count: r.sale_items?.length || 0,
  }));
}

module.exports = { createSaleViaRpc, getReceipt, list };
