const adjustmentService = require("../services/adjustmentService");

async function createAdjustment(req, res) {
  try {
    const detail = await adjustmentService.createAdjustment({
      user: req.user,
      payload: req.body,
    });
    const typeLabels = {
      return_supplier: "Retur ke supplier",
      sales_return: "Retur pelanggan",
      stock_adjustment: "Penyesuaian stok",
    };
    const isPending = detail.status === "pending";
    const msg = isPending
      ? `${typeLabels[detail.type]} berhasil dibuat — menunggu persetujuan admin..`
      : `${typeLabels[detail.type] || "Penyesuaian stok"} berhasil disimpan.`;
    return res.status(201).json({ message: msg, data: detail });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) {
      console.error("[POS-ADJ] createAdjustment error:", err.message);
    } else {
      console.warn(`[POS-ADJ] ${err.rule || ""} ${status}: ${err.message}`);
    }
    return res.status(status).json({ error: err.message, rule: err.rule || null });
  }
}

async function approveAdjustment(req, res) {
  try {
    const detail = await adjustmentService.approveAdjustment({
      adminUser: req.user,
      adjustmentId: req.params.id,
    });
    return res.json({
      message: "Retur pelanggan berhasil disetujui!",
      data: detail,
    });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error("[POS-ADJ] approve error:", err.message);
    return res.status(status).json({ error: err.message, rule: err.rule || null });
  }
}

async function rejectAdjustment(req, res) {
  try {
    const { reason } = req.body || {};
    const detail = await adjustmentService.rejectAdjustment({
      adminUser: req.user,
      adjustmentId: req.params.id,
      reason,
    });
    return res.json({
      message: "Retur pelanggan ditolak",
      data: detail,
    });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error("[POS-ADJ] reject error:", err.message);
    return res.status(status).json({ error: err.message });
  }
}

// Manager Override Opsi A: Kasir submit username+password admin di layar POS
async function approvePIN(req, res) {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Username dan password admin wajib diisi" });
    }
    const detail = await adjustmentService.verifyAdminAndApprove({
      adjustmentId: req.params.id,
      username,
      password,
    });
    return res.json({
      message: "Retur pelanggan disetujui oleh admin (on-site)",
      data: detail,
    });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error("[POS-ADJ] approvePIN error:", err.message);
    return res.status(status).json({ error: err.message, rule: err.rule || null });
  }
}

async function listAdjustments(req, res) {
  try {
    const { type, from, to, limit, status } = req.query;
    const data = await adjustmentService.listAdjustments({
      type: type || null,
      from,
      to,
      limit: limit ? parseInt(limit, 10) : 50,
      status: status || null,
    });
    return res.json({ data });
  } catch (err) {
    console.error("[POS-ADJ] listAdjustments error:", err.message);
    return res.status(500).json({ error: "Gagal memuat daftar penyesuaian stok" });
  }
}

async function getAdjustmentDetail(req, res) {
  try {
    const data = await adjustmentService.getAdjustmentDetail(req.params.id);
    if (!data) return res.status(404).json({ error: "Data tidak ditemukan" });
    return res.json({ data });
  } catch (err) {
    console.error("[POS-ADJ] getDetail error:", err.message);
    return res.status(500).json({ error: "Gagal memuat detail penyesuaian stok" });
  }
}

async function pendingCount(req, res) {
  try {
    const count = await adjustmentService.countPending();
    return res.json({ count });
  } catch (err) {
    console.error("[POS-ADJ] pendingCount error:", err.message);
    return res.json({ count: 0 });
  }
}

async function lookupSale(req, res) {
  try {
    const { kode } = req.query;
    const data = await adjustmentService.lookupSale(kode?.trim() || "");
    return res.json({ data });
  } catch (err) {
    console.error("[POS-ADJ] lookupSale error:", err.message);
    return res.status(500).json({ error: "Gagal mencari transaksi penjualan" });
  }
}

async function lookupPurchase(req, res) {
  try {
    const { nota } = req.query;
    const data = await adjustmentService.lookupPurchase(nota?.trim() || "");
    return res.json({ data });
  } catch (err) {
    console.error("[POS-ADJ] lookupPurchase error:", err.message);
    return res.status(500).json({ error: "Gagal mencari pembelian supplier" });
  }
}

async function resolveSupplierReturn(req, res) {
  try {
    const detail = await adjustmentService.resolveSupplierReturn({
      adminUser: req.user,
      adjustmentId: req.params.id,
    });
    return res.json({
      message: "Retur supplier diselesaikan — barang ganti telah masuk gudang.",
      data: detail,
    });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error("[POS-ADJ] resolveSupplier error:", err.message);
    return res.status(status).json({ error: err.message, rule: err.rule || null });
  }
}

module.exports = {
  createAdjustment,
  approveAdjustment,
  rejectAdjustment,
  approvePIN,
  resolveSupplierReturn,
  listAdjustments,
  getAdjustmentDetail,
  pendingCount,
  lookupSale,
  lookupPurchase,
};
