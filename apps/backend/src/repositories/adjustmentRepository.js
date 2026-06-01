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

async function list({ type, from, to, limit = 50, status, reference_sale_id }) {
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
  if (reference_sale_id) query = query.eq("reference_sale_id", reference_sale_id);

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

  // Hitung qty yang sudah diretur (pending/approved/selesai) per (sale_id, product_id)
  const saleIds = data.map((s) => s.id);
  const returMap = new Map(); // key: `${saleId}_${productId}`, value: total returned qty

  const { data: adjData } = await supabase
    .from("stock_adjustments")
    .select("id, reference_sale_id")
    .in("reference_sale_id", saleIds)
    .eq("type", "sales_return")
    .in("status", ["pending", "approved", "selesai"]);

  if (adjData && adjData.length > 0) {
    const adjIds = adjData.map((a) => a.id);
    const adjToSale = new Map(adjData.map((a) => [a.id, a.reference_sale_id]));
    const { data: itemData } = await supabase
      .from("stock_adjustment_items")
      .select("adjustment_id, product_id, qty")
      .in("adjustment_id", adjIds);
    for (const it of itemData || []) {
      const saleId = adjToSale.get(it.adjustment_id);
      if (!saleId) continue;
      const key = `${saleId}_${it.product_id}`;
      returMap.set(key, (returMap.get(key) || 0) + it.qty);
    }
  }

  return data.map((sale) => ({
    id: sale.id,
    kode_transaksi: sale.kode_transaksi,
    user_id: sale.user_id,
    total_harga: sale.total_harga,
    created_at: sale.created_at,
    items: (sale.sale_items || []).map((it) => {
      const already_returned_qty = returMap.get(`${sale.id}_${it.product_id}`) || 0;
      return {
        id: it.id,
        product_id: it.product_id,
        kode_barang: it.products?.kode_barang,
        nama_barang: it.products?.nama_barang,
        merk: it.products?.merk,
        qty: it.qty,
        harga_satuan: Number(it.harga_satuan),
        diskon_persen: Number(it.diskon_persen || 0),
        subtotal: Number(it.subtotal),
        already_returned_qty,
        available_qty: Math.max(0, it.qty - already_returned_qty),
      };
    }),
  }));
}

// Kembalikan qty yang sudah diretur per product_id untuk satu sale
async function getReturnsForSale(saleId) {
  const { data: adjs } = await supabase
    .from("stock_adjustments")
    .select("id")
    .eq("reference_sale_id", saleId)
    .eq("type", "sales_return")
    .in("status", ["approved", "selesai"]);

  if (!adjs || adjs.length === 0) return [];

  const adjIds = adjs.map((a) => a.id);
  const { data: items } = await supabase
    .from("stock_adjustment_items")
    .select("product_id, qty")
    .in("adjustment_id", adjIds);

  const map = new Map();
  for (const it of items || []) {
    map.set(it.product_id, (map.get(it.product_id) || 0) + it.qty);
  }
  return Array.from(map.entries()).map(([product_id, returned_qty]) => ({
    product_id,
    returned_qty,
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
  getReturnsForSale,
};
