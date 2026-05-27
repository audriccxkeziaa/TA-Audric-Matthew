const supabase = require("../config/supabase");

async function createViaRpc({
  userId,
  kode,
  type,
  referenceSaleId,
  referencePurchaseId,
  alasan,
  catatan,
  items,
}) {
  const { data, error } = await supabase.rpc("fn_create_stock_adjustment", {
    p_user_id: userId,
    p_kode: kode,
    p_type: type,
    p_reference_sale_id: referenceSaleId || null,
    p_reference_purchase_id: referencePurchaseId || null,
    p_alasan: alasan,
    p_catatan: catatan || null,
    p_items: items,
  });

  if (error) {
    const err = new Error(error.message);
    err.code = error.code;
    err.details = error.details;
    err.hint = error.hint;
    throw err;
  }
  return data;
}

async function getDetail(adjustmentId) {
  const { data: adj, error: adjErr } = await supabase
    .from("stock_adjustments")
    .select(
      "id, kode_adjustment, type, user_id, reference_sale_id, reference_purchase_id, alasan, catatan, total_qty, created_at"
    )
    .eq("id", adjustmentId)
    .single();
  if (adjErr) throw new Error("Gagal memuat detail penyesuaian stok");

  let username = null;
  if (adj.user_id) {
    const { data: u } = await supabase
      .from("users")
      .select("username")
      .eq("id", adj.user_id)
      .single();
    username = u?.username || null;
  }

  const { data: items, error: itemsErr } = await supabase
    .from("stock_adjustment_items")
    .select(
      "id, product_id, qty, kondisi, harga_satuan, products(kode_barang, nama_barang, merk)"
    )
    .eq("adjustment_id", adjustmentId)
    .order("created_at", { ascending: true });
  if (itemsErr) throw new Error("Gagal memuat item penyesuaian stok");

  return {
    ...adj,
    username,
    items: (items || []).map((it) => ({
      id: it.id,
      product_id: it.product_id,
      kode_barang: it.products?.kode_barang,
      nama_barang: it.products?.nama_barang,
      merk: it.products?.merk,
      qty: it.qty,
      kondisi: it.kondisi,
      harga_satuan: Number(it.harga_satuan),
    })),
  };
}

async function list({ type, from, to, limit = 50 }) {
  let query = supabase
    .from("stock_adjustments")
    .select("id, kode_adjustment, type, user_id, alasan, total_qty, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (type) query = query.eq("type", type);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);

  const { data, error } = await query;
  if (error) throw new Error("Gagal memuat daftar penyesuaian stok");

  const userIds = [...new Set((data || []).map((r) => r.user_id).filter(Boolean))];
  let userMap = new Map();
  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from("users")
      .select("id, username")
      .in("id", userIds);
    userMap = new Map(users?.map((u) => [u.id, u.username]) || []);
  }

  return (data || []).map((r) => ({
    ...r,
    username: userMap.get(r.user_id) || null,
  }));
}

async function lookupSaleByKode(kode) {
  const { data, error } = await supabase
    .from("sales")
    .select("id, kode_transaksi, user_id, total_harga, created_at")
    .ilike("kode_transaksi", `%${kode}%`)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw new Error("Gagal mencari transaksi penjualan");

  if (!data || data.length === 0) return [];

  const results = [];
  for (const sale of data) {
    const { data: items } = await supabase
      .from("sale_items")
      .select(
        "id, product_id, qty, harga_satuan, diskon_persen, subtotal, products(kode_barang, nama_barang, merk)"
      )
      .eq("sale_id", sale.id);

    results.push({
      ...sale,
      items: (items || []).map((it) => ({
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
    });
  }
  return results;
}

async function lookupPurchaseByNota(nota) {
  let query = supabase
    .from("purchases")
    .select("id, no_nota_supplier, user_id, total, status_validasi, created_at")
    .eq("status_validasi", "tervalidasi")
    .order("created_at", { ascending: false })
    .limit(10);

  if (nota) {
    query = query.ilike("no_nota_supplier", `%${nota}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error("Gagal mencari pembelian supplier");

  if (!data || data.length === 0) return [];

  const results = [];
  for (const purchase of data) {
    const { data: items } = await supabase
      .from("purchase_items")
      .select(
        "id, product_id, qty, harga_beli, diskon_persen, source, products(kode_barang, nama_barang, merk)"
      )
      .eq("purchase_id", purchase.id);

    results.push({
      ...purchase,
      items: (items || []).map((it) => ({
        id: it.id,
        product_id: it.product_id,
        kode_barang: it.products?.kode_barang,
        nama_barang: it.products?.nama_barang,
        merk: it.products?.merk,
        qty: it.qty,
        harga_beli: Number(it.harga_beli),
        diskon_persen: Number(it.diskon_persen || 0),
      })),
    });
  }
  return results;
}

module.exports = {
  createViaRpc,
  getDetail,
  list,
  lookupSaleByKode,
  lookupPurchaseByNota,
};
