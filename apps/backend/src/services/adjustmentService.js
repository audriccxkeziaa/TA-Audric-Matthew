const { createClient } = require("@supabase/supabase-js");
const supabaseAdmin = require("../config/supabase");
const adjustmentRepository = require("../repositories/adjustmentRepository");
const stockLogRepository = require("../repositories/stockLogRepository");
const ruleEngine = require("./ruleEngine");
const log = require("../utils/logger");

const { nextDocumentNumber } = require("../utils/documentCounter");

// Guard RBAC: lempar 403 bila user bukan admin. `action` mengisi pesan error
// (mis. "menyetujui retur") → pesan sama persis seperti sebelumnya.
function requireAdmin(user, action) {
  if (user.role !== "admin") {
    const e = new Error(`Hanya admin yang dapat ${action}`);
    e.status = 403;
    throw e;
  }
}

// Map error RPC (SQLSTATE custom dari trigger) → Error ber-status untuk dilempar
// ke controller. Dipakai oleh approve/resolve/verify yang pola catch-nya identik.
function throwMappedRpcError(err) {
  const mapped = ruleEngine.mapDbErrorToHttp(err);
  const e = new Error(mapped.message || err.message);
  e.status = mapped.status || 400;
  e.rule = mapped.rule;
  throw e;
}

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
    nominal: refundTotal,
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
    // Kebijakan bisnis CV Asia Jaya Maju: retur pelanggan HANYA barang bagus
    // (barang rusak tidak diterima). 'rusak' ditolak eksplisit.
    if (type === "sales_return" && it.kondisi != null && it.kondisi !== "bagus") {
      return `Item baris #${i + 1}: retur pelanggan hanya untuk barang kondisi bagus`;
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

  // Retur pelanggan: validasi server-authoritative terhadap transaksi asli —
  // (1) item harus ada di transaksi referensi, (2) qty retur ≤ qty terjual −
  // yang sudah diretur, (3) harga refund diambil dari harga ASLI transaksi
  // (bukan input client) → cegah manipulasi nominal refund.
  let saleCtx = null;
  if (type === "sales_return") {
    saleCtx = await adjustmentRepository.getSaleReturnContext(reference_sale_id);
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const info = saleCtx.get(it.product_id);
      if (!info) {
        const e = new Error(
          `Item baris #${i + 1} tidak ada pada transaksi penjualan referensi`
        );
        e.status = 400;
        throw e;
      }
      const available = info.qty_sold - info.already_returned;
      if (Number(it.qty) > available) {
        // Tidak diblok diam-diam: dicoba → DITOLAK & tercatat REJECTED di audit.
        await stockLogRepository.write({
          product_id: it.product_id,
          user_id: user.id,
          source_type: "adjustment",
          rule_triggered: "RETUR",
          rule_action: "REJECTED",
          reason_detail: `Retur pelanggan ${it.qty} unit melebihi sisa yang bisa diretur (maks ${Math.max(0, available)})`,
          context_payload: {
            product_id: it.product_id,
            qty_retur: Number(it.qty),
            maks_bisa_diretur: Math.max(0, available),
          },
        });
        const e = new Error(
          `Retur ditolak — qty (${it.qty}) melebihi sisa yang bisa diretur (maks ${Math.max(0, available)})`
        );
        e.status = 409;
        e.rule = "RETUR";
        throw e;
      }
    }
  }

  // return_supplier: batas retur per item = MIN(qty di nota beli, stok aktual master).
  //  - Tak boleh > yang dibeli di nota itu (nota beli 10 → maks 10 walau stok 20).
  //  - Tak boleh > stok aktual (stok tinggal 5 → maks 5 walau nota 8).
  // Input UI bebas; pelanggaran DITOLAK saat confirm & tercatat REJECTED (demonstratif).
  if (type === "return_supplier") {
    const ids = [...new Set(items.map((it) => it.product_id))];
    const { data: prods } = await supabaseAdmin
      .from("products")
      .select("id, nama_barang, stok")
      .in("id", ids);
    const stokMap = new Map((prods || []).map((p) => [p.id, p]));
    // Jumlah per produk yang DIBELI di nota referensi
    const { data: pitems } = await supabaseAdmin
      .from("purchase_items")
      .select("product_id, qty")
      .eq("purchase_id", reference_purchase_id);
    const notaMap = new Map();
    for (const pi of pitems || []) {
      notaMap.set(pi.product_id, (notaMap.get(pi.product_id) || 0) + Number(pi.qty));
    }
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const p = stokMap.get(it.product_id);
      const stokAktual = Number(p?.stok ?? 0);
      const notaQty = Number(notaMap.get(it.product_id) ?? 0);
      const batas = Math.min(notaQty, stokAktual);
      if (Number(it.qty) > batas) {
        const sebab =
          notaQty <= stokAktual
            ? `melebihi jumlah di nota beli (${notaQty})`
            : `melebihi stok aktual (${stokAktual})`;
        await stockLogRepository.write({
          product_id: it.product_id,
          user_id: user.id,
          source_type: "adjustment",
          rule_triggered: "RETUR",
          rule_action: "REJECTED",
          reason_detail: `Retur supplier ${it.qty} unit ${sebab} untuk "${p?.nama_barang || it.product_id}" (maks ${batas})`,
          context_payload: {
            product_id: it.product_id,
            nama_barang: p?.nama_barang,
            qty_retur: Number(it.qty),
            qty_nota_beli: notaQty,
            stok_aktual: stokAktual,
            batas_maksimum: batas,
          },
        });
        const e = new Error(
          `Retur ditolak — qty (${it.qty}) ${sebab} untuk ${p?.nama_barang || "barang"} (maks ${batas})`
        );
        e.status = 409;
        e.rule = "RETUR";
        throw e;
      }
    }
  }

  const normalizedItems = items.map((it) => {
    const base = {
      product_id: it.product_id,
      qty: Number(it.qty),
      // sales_return selalu 'bagus' (kebijakan bisnis); tipe lain null.
      kondisi: type === "sales_return" ? "bagus" : null,
      // Harga: sales_return pakai harga ASLI transaksi (server); tipe lain dari input.
      harga_satuan:
        type === "sales_return"
          ? saleCtx.get(it.product_id)?.unit_price || 0
          : Number(it.harga_satuan || 0),
    };
    // stock_adjustment dikunci ke 'kurang' (penyusutan); tipe lain boleh kirim arah.
    if (type === "stock_adjustment") base.arah = "kurang";
    else if (it.arah) base.arah = it.arah;
    return base;
  });

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
    log.error("ADJ", `Commit ${type} gagal (RPC fn_create_stock_adjustment)`, err, {
      kode,
      type,
      status,
      username: user.username,
      jumlah_item: normalizedItems.length,
      rule: mapped.rule || null,
    });

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
  requireAdmin(adminUser, "menyetujui retur");

  let rpcResult;
  try {
    rpcResult = await adjustmentRepository.approveViaRpc({
      adjustmentId,
      adminId: adminUser.id,
    });
  } catch (err) {
    throwMappedRpcError(err);
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
  requireAdmin(adminUser, "menolak retur");

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
    throwMappedRpcError(err);
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

async function getReturnsForSale(saleId) {
  return adjustmentRepository.getReturnsForSale(saleId);
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
  requireAdmin(adminUser, "menyelesaikan retur supplier");

  let rpcResult;
  try {
    rpcResult = await adjustmentRepository.resolveViaRpc({
      adjustmentId,
      adminId: adminUser.id,
    });
  } catch (err) {
    throwMappedRpcError(err);
  }

  const detail = await adjustmentRepository.getDetail(adjustmentId);
  console.log(
    `[POS-ADJ] RESOLVED supplier return=${adjustmentId} oleh admin=${adminUser.username}`
  );
  return detail;
}

// Jurnal pembalik: hapus expense refund yang dibuat saat sales_return disetujui
async function reverseRefundExpense({ kode, userId }) {
  const { data: found } = await supabaseAdmin
    .from("expenses")
    .select("id, nominal")
    .eq("deskripsi", `Refund retur pelanggan — ${kode}`)
    .maybeSingle();
  if (!found) return;

  const { error } = await supabaseAdmin
    .from("expenses")
    .delete()
    .eq("id", found.id);
  if (error) {
    console.warn("[POS-ADJ] Gagal membalik expense refund:", error.message);
  } else {
    console.log(`[POS-ADJ] Expense refund ${found.id} (${kode}) dihapus sebagai jurnal pembalik void`);
  }
}

async function voidAdjustment({ adminUser, adjustmentId }) {
  requireAdmin(adminUser, "membatalkan retur");

  try {
    await adjustmentRepository.voidViaRpc({
      adjustmentId,
      adminId: adminUser.id,
    });
  } catch (err) {
    const e = new Error(err.message);
    e.status = err.status || 400;
    throw e;
  }

  const detail = await adjustmentRepository.getDetail(adjustmentId);

  // Balik expense refund jika sales_return
  if (detail.type === "sales_return") {
    await reverseRefundExpense({
      kode: detail.kode_adjustment,
      userId: adminUser.id,
    });
  }

  console.log(
    `[POS-ADJ] VOIDED adjustment=${adjustmentId} oleh admin=${adminUser.username}`
  );
  return detail;
}

module.exports = {
  createAdjustment,
  approveAdjustment,
  rejectAdjustment,
  verifyAdminAndApprove,
  resolveSupplierReturn,
  voidAdjustment,
  listAdjustments,
  getAdjustmentDetail,
  countPending,
  lookupSale,
  lookupPurchase,
  getReturnsForSale,
};
