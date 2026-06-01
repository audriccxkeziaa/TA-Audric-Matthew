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
  status = "approved",
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
    p_status: status,
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

async function approveViaRpc({ adjustmentId, adminId }) {
  const { data, error } = await supabase.rpc("fn_approve_stock_adjustment", {
    p_adjustment_id: adjustmentId,
    p_admin_id: adminId,
  });

  if (error) {
    const err = new Error(error.message);
    err.code = error.code;
    err.details = error.details;
    throw err;
  }
  return data;
}

async function rejectViaRpc({ adjustmentId, adminId, reason }) {
  const { data, error } = await supabase.rpc("fn_reject_stock_adjustment", {
    p_adjustment_id: adjustmentId,
    p_admin_id: adminId,
    p_reason: reason || "",
  });

  if (error) {
    const err = new Error(error.message);
    err.code = error.code;
    err.details = error.details;
    throw err;
  }
  return data;
}

async function getDetail(adjustmentId) {
  const { data: adj, error: adjErr } = await supabase
    .from("stock_adjustments")
    .select(
      "id, kode_adjustment, type, user_id, reference_sale_id, reference_purchase_id, alasan, catatan, total_qty, status, approved_by, approved_at, created_at"
    )
    .eq("id", adjustmentId)
    .single();
  if (adjErr) throw new Error("Gagal memuat detail penyesuaian stok");

  const userIds = [adj.user_id, adj.approved_by].filter(Boolean);
  let userMap = new Map();
  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from("users")
      .select("id, username")
      .in("id", [...new Set(userIds)]);
    userMap = new Map(users?.map((u) => [u.id, u.username]) || []);
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
    username: userMap.get(adj.user_id) || null,
    approved_by_username: userMap.get(adj.approved_by) || null,
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

async function list({ type, from, to, limit = 50, status }) {
  let query = supabase
    .from("stock_adjustments")
    .select(
      "id, kode_adjustment, type, user_id, alasan, total_qty, status, approved_by, approved_at, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (type) query = query.eq("type", type);
  if (status) query = query.eq("status", status);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);

  const { data, error } = await query;
  if (error) throw new Error("Gagal memuat daftar penyesuaian stok");

  const userIds = [
    ...new Set(
      (data || [])
        .flatMap((r) => [r.user_id, r.approved_by])
        .filter(Boolean)
    ),
  ];
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
    approved_by_username: userMap.get(r.approved_by) || null,
  }));
}

async function countPending() {
  const { count, error } = await supabase
    .from("stock_adjustments")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  if (error) return 0;
  return count || 0;
}

async function lookupSaleByKode(kode) {
  let query = supabase
    .from("sales")
    .select(
      "id, kode_transaksi, user_id, total_harga, created_at, sale_items(id, product_id, qty, harga_satuan, diskon_persen, subtotal, products(kode_barang, nama_barang, merk))"
    )
    .order("created_at", { ascending: false })
    .limit(30);

  if (kode) {
    query = query.ilike("kode_transaksi", `%${kode}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error("Gagal mencari transaksi penjualan");
  if (!data || data.length === 0) return [];

  return data.map((sale) => ({
    id: sale.id,
    kode_transaksi: sale.kode_transaksi,
    user_id: sale.user_id,
    total_harga: sale.total_harga,
    created_at: sale.created_at,
    items: (sale.sale_items || []).map((it) => ({
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
  }));
}

async function lookupPurchaseByNota(nota) {
  let query = supabase
    .from("purchases")
    .select(
      "id, no_nota_supplier, supplier_name, user_id, total, status_validasi, created_at, purchase_items(id, product_id, qty, harga_beli, diskon_persen, source, products(kode_barang, nama_barang, merk))"
    )
    .eq("status_validasi", "tervalidasi")
    .order("created_at", { ascending: false })
    .limit(30);

  if (nota) {
    query = query.ilike("no_nota_supplier", `%${nota}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error("Gagal mencari pembelian supplier");
  if (!data || data.length === 0) return [];

  return data.map((purchase) => ({
    id: purchase.id,
    no_nota_supplier: purchase.no_nota_supplier,
    supplier_name: purchase.supplier_name || null,
    user_id: purchase.user_id,
    total: purchase.total,
    status_validasi: purchase.status_validasi,
    created_at: purchase.created_at,
    items: (purchase.purchase_items || []).map((it) => ({
      id: it.id,
      product_id: it.product_id,
      kode_barang: it.products?.kode_barang,
      nama_barang: it.products?.nama_barang,
      merk: it.products?.merk,
      qty: it.qty,
      harga_beli: Number(it.harga_beli),
      diskon_persen: Number(it.diskon_persen || 0),
    })),
  }));
}

async function resolveViaRpc({ adjustmentId, adminId }) {
  const { data, error } = await supabase.rpc("fn_resolve_supplier_return", {
    p_adjustment_id: adjustmentId,
    p_admin_id: adminId,
  });
  if (error) {
    const err = new Error(error.message);
    err.code = error.code;
    err.details = error.details;
    throw err;
  }
  return data;
}

async function voidViaRpc({ adjustmentId, adminId }) {
  const { data, error } = await supabase.rpc("fn_void_adjustment", {
    p_adjustment_id: adjustmentId,
    p_admin_id: adminId,
  });
  if (error) {
    const err = new Error(error.message);
    err.code = error.code;
    err.details = error.details;
    throw err;
  }
  return data;
}

module.exports = {
  createViaRpc,
  approveViaRpc,
  rejectViaRpc,
  resolveViaRpc,
  voidViaRpc,
  getDetail,
  list,
  countPending,
  lookupSaleByKode,
  lookupPurchaseByNota,
};
