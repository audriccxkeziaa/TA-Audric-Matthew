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
    return res.status(201).json({
      message: `${typeLabels[detail.type] || "Penyesuaian stok"} berhasil disimpan`,
      data: detail,
    });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) {
      console.error("[POS-ADJ] createAdjustment error:", err.message);
    } else {
      console.warn(`[POS-ADJ] ${err.rule || ""} ${status}: ${err.message}`);
    }
    return res.status(status).json({
      error: err.message,
      rule: err.rule || null,
    });
  }
}

async function listAdjustments(req, res) {
  try {
    const { type, from, to, limit } = req.query;
    const data = await adjustmentService.listAdjustments({
      type: type || null,
      from,
      to,
      limit: limit ? parseInt(limit, 10) : 50,
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

async function lookupSale(req, res) {
  try {
    const { kode } = req.query;
    if (!kode || !kode.trim()) {
      return res.status(400).json({ error: "Parameter kode wajib diisi" });
    }
    const data = await adjustmentService.lookupSale(kode.trim());
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

module.exports = {
  createAdjustment,
  listAdjustments,
  getAdjustmentDetail,
  lookupSale,
  lookupPurchase,
};
