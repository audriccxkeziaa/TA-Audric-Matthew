const { createClient } = require("@supabase/supabase-js");
const supabaseAdmin = require("../config/supabase");
const adjustmentRepository = require("../repositories/adjustmentRepository");
const stockLogRepository = require("../repositories/stockLogRepository");
const ruleEngine = require("./ruleEngine");

const { nextDocumentNumber } = require("../utils/documentCounter");

// Catat refund retur pelanggan sebagai pengeluaran agar saldo kas/omset berkurang.
async function recordRefundExpense({ kode, items, userId }) {
  const refundTotal = items
    .filter((it) => it.kondisi === "bagus")
    .reduce((sum, it) => sum + Number(it.qty) * Number(it.harga_satuan), 0);
  if (refundTotal <= 0) return;
  const { error } = await supabaseAdmin.from("expenses").insert({
    tanggal: new Date().toISOString().split("T")[0],
    jenis: "refund_pelanggan",
    deskripsi: `Refund retur pelanggan — ${kode}`,
    jumlah: refundTotal,
    user_id: userId,
  });
  if (error) {
    console.warn("[POS-ADJ] Gagal mencatat expense refund:", error.message);
  }
}


function validatePayload({ type, alasan, items, reference_sale_id, reference_purchase_id }) {
  if (!["return_supplier", "sales_return", "stock_adjustment"].includes(type)) {
    return "Tipe penyesuaian tidak valid";
  }
  if (!alasan || !alasan.trim()) {
    return "Alasan wajib diisi";
  }
  if (!Array.isArray(items) || items.length === 0) {
    return "Minimal 1 item harus disertakan";
  }

  if (type === "return_supplier" && !reference_purchase_id) {
    return "Retur supplier wajib menyertakan referensi pembelian (purchase)";
  }
  if (type === "sales_return" && !reference_sale_id) {
    return "Retur pelanggan wajib menyertakan referensi transaksi penjualan";
  }

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!it.product_id || typeof it.product_id !== "string") {
      return `Item baris #${i + 1}: product_id wajib string UUID`;
    }
    if (!Number.isInteger(it.qty) || it.qty <= 0) {
      return `Item baris #${i + 1}: qty wajib bilangan bulat > 0`;
    }
    if (type === "sales_return" && !["bagus", "rusak"].includes(it.kondisi)) {
      return `Item baris #${i + 1}: kondisi wajib 'bagus' atau 'rusak' untuk retur pelanggan`;
    }
  }
  return null;
}

async function createAdjustment({ user, payload }) {
  const {
    type,
    reference_sale_id,
    reference_purchase_id,
    alasan,
    catatan,
    items,
  } = payload || {};

  // RBAC: stock_adjustment hanya admin
  if (type === "stock_adjustment" && user.role !== "admin") {
    const e = new Error("Hanya admin yang dapat melakukan penyesuaian stok");
    e.status = 403;
    throw e;
  }

  const validationError = validatePayload({
    type,
    alasan,
    items,
    reference_sale_id,
    reference_purchase_id,
  });
  if (validationError) {
    const e = new Error(validationError);
    e.status = 400;
    throw e;
  }

  const normalizedItems = items.map((it) => ({
    product_id: it.product_id,
    qty: Number(it.qty),
    // sales_return selalu kondisi 'bagus': stok kembali + refund dicatat ke expenses
    kondisi: type === "sales_return" ? "bagus" : null,
    harga_satuan: Number(it.harga_satuan || 0),
  }));

  const kode = await nextDocumentNumber(type);

  // Manager Override: sales_return dibuat kasir → pending
  // sales_return dibuat admin → langsung approved (auto-approve)
  // Tipe lain → langsung approved
  let status = "approved";
  if (type === "sales_return" && user.role !== "admin") {
    status = "pending";
  }

  let rpcResult;
  try {
    rpcResult = await adjustmentRepository.createViaRpc({
      userId: user.id,
      kode,
      type,
      referenceSaleId: reference_sale_id || null,
      referencePurchaseId: reference_purchase_id || null,
      alasan: alasan.trim(),
      catatan: catatan?.trim() || null,
      items: normalizedItems,
      status,
    });
  } catch (err) {
    const mapped = ruleEngine.mapDbErrorToHttp(err);

    if (mapped.rule === "R1") {
      await stockLogRepository.write({
        product_id: null,
        user_id: user.id,
        source_type: "adjustment",
        rule_triggered: "R1",
        rule_action: "REJECTED",
        reason_detail: `Stok tidak cukup saat ${type}: ${mapped.message}`,
        context_payload: { kode, type, items: normalizedItems },
      });
    }

    const e = new Error(mapped.message);
    e.status = mapped.status;
    e.rule = mapped.rule;
    throw e;
  }

  if (type === "sales_return" && status === "approved") {
    await recordRefundExpense({ kode, items: normalizedItems, userId: user.id });
  }

  const detail = await adjustmentRepository.getDetail(rpcResult.adjustment_id);
  console.log(
    `[POS-ADJ] ${type} kode=${kode} status=${status} oleh user=${user.username} total_qty=${rpcResult.total_qty}`
  );
  return detail;
}

async function approveAdjustment({ adminUser, adjustmentId }) {
  if (adminUser.role !== "admin") {
    const e = new Error("Hanya admin yang dapat menyetujui retur");
    e.status = 403;
    throw e;
  }

  let rpcResult;
  try {
    rpcResult = await adjustmentRepository.approveViaRpc({
      adjustmentId,
      adminId: adminUser.id,
    });
  } catch (err) {
    const mapped = ruleEngine.mapDbErrorToHttp(err);
    const e = new Error(mapped.message || err.message);
    e.status = mapped.status || 400;
    e.rule = mapped.rule;
    throw e;
  }

  const detail = await adjustmentRepository.getDetail(adjustmentId);
  if (detail.type === "sales_return") {
    await recordRefundExpense({
      kode: detail.kode_adjustment,
      items: detail.items || [],
      userId: adminUser.id,
    });
  }
  console.log(
    `[POS-ADJ] APPROVED adjustment=${adjustmentId} oleh admin=${adminUser.username}`
  );
  return detail;
}

async function rejectAdjustment({ adminUser, adjustmentId, reason }) {
  if (adminUser.role !== "admin") {
    const e = new Error("Hanya admin yang dapat menolak retur");
    e.status = 403;
    throw e;
  }

  try {
    await adjustmentRepository.rejectViaRpc({
      adjustmentId,
      adminId: adminUser.id,
      reason: reason || "",
    });
  } catch (err) {
    const e = new Error(err.message);
    e.status = 400;
    throw e;
  }

  const detail = await adjustmentRepository.getDetail(adjustmentId);
  console.log(
    `[POS-ADJ] REJECTED adjustment=${adjustmentId} oleh admin=${adminUser.username}`
  );
  return detail;
}

// Manager Override Opsi A: verifikasi PIN (password admin) di layar kasir
async function verifyAdminAndApprove({ adjustmentId, username, password }) {
  // 1. Cari admin user di database
  const { data: profile, error: profileErr } = await supabaseAdmin
    .from("users")
    .select("id, username, role, is_active")
    .eq("username", username.trim())
    .single();

  if (profileErr || !profile) {
    const e = new Error("Username admin tidak ditemukan");
    e.status = 422;
    throw e;
  }

  if (profile.role !== "admin") {
    const e = new Error("User bukan admin — tidak berhak menyetujui");
    e.status = 403;
    throw e;
  }

  if (profile.is_active === false) {
    const e = new Error("Akun admin tidak aktif");
    e.status = 403;
    throw e;
  }

  // 2. Verifikasi password via Supabase Auth
  const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(
    profile.id
  );
  if (!authUser?.user?.email) {
    const e = new Error("Gagal memverifikasi kredensial admin");
    e.status = 422;
    throw e;
  }

  const tempClient = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );
  const { error: signInErr } = await tempClient.auth.signInWithPassword({
    email: authUser.user.email,
    password,
  });

  if (signInErr) {
    const e = new Error("Password admin salah");
    e.status = 422;
    throw e;
  }

  // Sign out the temp session immediately
  await tempClient.auth.signOut();

  // 3. Approve via RPC
  let rpcResult;
  try {
    rpcResult = await adjustmentRepository.approveViaRpc({
      adjustmentId,
      adminId: profile.id,
    });
  } catch (err) {
    const mapped = ruleEngine.mapDbErrorToHttp(err);
    const e = new Error(mapped.message || err.message);
    e.status = mapped.status || 400;
    e.rule = mapped.rule;
    throw e;
  }

  const detail = await adjustmentRepository.getDetail(adjustmentId);
  if (detail.type === "sales_return") {
    await recordRefundExpense({
      kode: detail.kode_adjustment,
      items: detail.items || [],
      userId: profile.id,
    });
  }
  console.log(
    `[POS-ADJ] PIN-APPROVED adjustment=${adjustmentId} oleh admin=${profile.username} (on-site)`
  );
  return detail;
}

async function listAdjustments(filter) {
  return adjustmentRepository.list(filter);
}

async function getAdjustmentDetail(id) {
  return adjustmentRepository.getDetail(id);
}

async function countPending() {
  return adjustmentRepository.countPending();
}

async function lookupSale(kode) {
  return adjustmentRepository.lookupSaleByKode(kode);
}

async function lookupPurchase(nota) {
  return adjustmentRepository.lookupPurchaseByNota(nota);
}

// Tahap 2 Retur Supplier: konfirmasi barang ganti diterima → stok bertambah, status='selesai'
async function resolveSupplierReturn({ adminUser, adjustmentId }) {
  if (adminUser.role !== "admin") {
    const e = new Error("Hanya admin yang dapat menyelesaikan retur supplier");
    e.status = 403;
    throw e;
  }

  let rpcResult;
  try {
    rpcResult = await adjustmentRepository.resolveViaRpc({
      adjustmentId,
      adminId: adminUser.id,
    });
  } catch (err) {
    const mapped = ruleEngine.mapDbErrorToHttp(err);
    const e = new Error(mapped.message || err.message);
    e.status = mapped.status || 400;
    e.rule = mapped.rule;
    throw e;
  }

  const detail = await adjustmentRepository.getDetail(adjustmentId);
  console.log(
    `[POS-ADJ] RESOLVED supplier return=${adjustmentId} oleh admin=${adminUser.username}`
  );
  return detail;
}

module.exports = {
  createAdjustment,
  approveAdjustment,
  rejectAdjustment,
  verifyAdminAndApprove,
  resolveSupplierReturn,
  listAdjustments,
  getAdjustmentDetail,
  countPending,
  lookupSale,
  lookupPurchase,
};
