const productRepository = require("../repositories/productRepository");
const salesRepository = require("../repositories/salesRepository");
const stockLogRepository = require("../repositories/stockLogRepository");
const ruleEngine = require("./ruleEngine");
const { nextDocumentNumber } = require("../utils/documentCounter");
const log = require("../utils/logger");

// Pilar 2 — hanya validasi struktur minimal: product_id + qty.
// Harga, diskon, subtotal, grand_total TIDAK diterima dari client.
function validatePayload(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return "Keranjang kosong: minimal 1 item";
  }
  for (const it of items) {
    if (!it.product_id || typeof it.product_id !== "string") {
      return "product_id wajib string UUID";
    }
    if (!Number.isInteger(it.qty) || it.qty <= 0) {
      return "qty wajib bilangan bulat > 0";
    }
    if (
      it.diskon_persen != null &&
      (typeof it.diskon_persen !== "number" ||
        it.diskon_persen < 0 ||
        it.diskon_persen > 100)
    ) {
      return "diskon_persen harus angka 0-100";
    }
  }
  return null;
}

// Field yang HARUS dihitung server (otoritatif) — dilarang dari request.
// CATATAN: diskon_persen TIDAK di daftar ini — diskon per item adalah input
// sah dari kasir (divalidasi 0-100), bukan manipulasi harga.
const BLACKLISTED_PRICE_FIELDS = [
  "harga_satuan", "harga_jual", "harga_beli",
  "diskon_rate",
  "subtotal", "grand_total", "total",
];

// Audit R1: tulis stock_logs REJECTED untuk SETIAP item yang gagal pre-check stok
// (stok TIDAK berubah — hanya jejak forensik). Dipisah agar alur createSale ringkas.
async function logR1Rejections({ failures, products, user, items }) {
  const productMap = new Map(products.map((p) => [p.id, p]));
  for (const f of failures) {
    const p = productMap.get(f.product_id);
    await stockLogRepository.write({
      product_id: f.product_id,
      user_id: user.id,
      delta_qty: 0,
      stok_sebelum: p?.stok ?? null,
      stok_sesudah: p?.stok ?? null,
      source_type: "sales",
      rule_triggered: "R1",
      rule_action: "REJECTED",
      reason_detail: f.reason,
      context_payload: { attempted_items: items, failure: f },
    });
  }
}

async function createSale({ user, items }) {
  // Pilar 2 — Strip & log: buang semua field harga/diskon dari request.
  // Server adalah satu-satunya authority untuk kalkulasi harga.
  const hasTamperedFields = Array.isArray(items) &&
    items.some((it) => BLACKLISTED_PRICE_FIELDS.some((f) => it[f] !== undefined));
  if (hasTamperedFields) {
    log.warn("SECURITY", "Parameter harga terdeteksi di request penjualan — diabaikan (harga otoritatif dari DB).", {
      user_id: user.id,
      username: user.username,
    });
  }

  // Ambil product_id + qty + diskon_persen (diskon = input sah kasir).
  // Harga TETAP dibuang di sini — server menentukan harga dari DB.
  const safeItems = Array.isArray(items)
    ? items.map(({ product_id, qty, diskon_persen }) => ({
        product_id,
        qty,
        diskon_persen,
      }))
    : [];

  const payloadError = validatePayload(safeItems);
  if (payloadError) {
    const e = new Error(payloadError);
    e.status = 400;
    throw e;
  }

  const ids = [...new Set(safeItems.map((i) => i.product_id))];
  const products = await productRepository.findByIds(ids);

  // R1 LAYER 1 — pre-check stok
  const failures = ruleEngine.checkR1StockAvailability({ items: safeItems, products });

  if (failures.length > 0) {
    await logR1Rejections({ failures, products, user, items: safeItems });

    const e = new Error(failures.map((f) => f.reason).join("; "));
    e.status = 409;
    e.rule = "R1";
    e.failures = failures;
    throw e;
  }

  const kodeTransaksi = await nextDocumentNumber("sale");
  const productMap = new Map(products.map((p) => [p.id, p]));

  // Pilar 2 — Harga 100% dari DB (otoritatif). Diskon per item diambil dari
  // input kasir yang sudah divalidasi (0-100); subtotal final dihitung di
  // fn_create_sale: qty × harga × (1 − diskon/100).
  const secureItems = safeItems.map((it) => {
    const dbProduct = productMap.get(it.product_id);
    return {
      product_id: it.product_id,
      qty: it.qty,
      harga_satuan: Number(dbProduct.harga_jual),   // authoritative dari DB
      diskon_persen: Number(it.diskon_persen) || 0, // diskon per item dari kasir (0-100)
    };
  });

  let rpcResult;
  try {
    rpcResult = await salesRepository.createSaleViaRpc({
      userId: user.id,
      kodeTransaksi,
      items: secureItems,
    });
  } catch (err) {
    const mapped = ruleEngine.mapDbErrorToHttp(err);
    log.error("SALES", "Commit penjualan gagal (RPC fn_create_sale)", err, {
      kode_transaksi: kodeTransaksi,
      username: user.username,
      jumlah_item: secureItems.length,
      rule: mapped.rule || null,
    });

    if (mapped.rule === "R1") {
      await stockLogRepository.write({
        product_id: null,
        user_id: user.id,
        source_type: "sales",
        rule_triggered: "R1",
        rule_action: "REJECTED",
        reason_detail: `Race condition R1 di trigger DB: ${mapped.message}`,
        context_payload: { kode_transaksi: kodeTransaksi, items: safeItems },
      });
    }
    if (mapped.rule === "R3") {
      await stockLogRepository.write({
        product_id: null,
        user_id: user.id,
        source_type: "sales",
        rule_triggered: "R3",
        rule_action: "TRIGGERED",
        reason_detail: mapped.message,
        context_payload: { kode_transaksi: kodeTransaksi, items: safeItems },
      });
    }

    const e = new Error(mapped.message);
    e.status = mapped.status;
    e.rule = mapped.rule;
    throw e;
  }

  let receipt;
  try {
    receipt = await salesRepository.getReceipt(rpcResult.sale_id);
  } catch (receiptErr) {
    log.warn("SALES", "getReceipt gagal — kirim respons minimal (transaksi tetap tersimpan).", {
      sale_id: rpcResult.sale_id,
      kode_transaksi: kodeTransaksi,
    });
    receipt = {
      id: rpcResult.sale_id,
      kode_transaksi: kodeTransaksi,
      total_harga: rpcResult.total_harga,
      kasir: user.username,
      items: [], // Items kosong karena gagal fetch
    };
  }

  log.info("SALES", `Transaksi ${receipt.kode_transaksi} sukses`, {
    username: user.username,
    total: receipt.total_harga,
  });
  return receipt;
}

async function listSales(filter) {
  return salesRepository.list(filter);
}

module.exports = { createSale, listSales };
