const productRepository = require("../repositories/productRepository");
const salesRepository = require("../repositories/salesRepository");
const stockLogRepository = require("../repositories/stockLogRepository");
const ruleEngine = require("./ruleEngine");
const { nextDocumentNumber } = require("../utils/documentCounter");

function validatePayload(items, productsFromDb = []) { // Tambahkan parameter kedua, yaitu products dari Supabase
  if (!Array.isArray(items) || items.length === 0) {
    return "Keranjang kosong: minimal 1 item";
  }

  // Buat Map untuk memudahkan pencarian harga asli
  const productMap = new Map(productsFromDb.map((p) => [p.id, p]));

  for (const it of items) {
    if (!it.product_id || typeof it.product_id !== "string") {
      return "product_id wajib string UUID";
    }
    if (!Number.isInteger(it.qty) || it.qty <= 0) {
      return "qty wajib bilangan bulat > 0";
    }
    if (typeof it.harga_satuan !== "number" || it.harga_satuan <= 0) {
      return "harga_satuan wajib angka > 0";
    }

    // Validasi Harga
    const dbProduct = productMap.get(it.product_id);
    if (dbProduct) {
       const hargaAsli = Number(dbProduct.harga_jual);
       const hargaInput = Number(it.harga_satuan);
       
       if (hargaAsli !== hargaInput) {
         return `Manipulasi Harga! ${dbProduct.nama_barang} aslinya ${hargaAsli}, anda mengirim ${hargaInput}`;
       }
    }
    // ----------------------------------------
  }
  return null;
}

async function createSale({ user, items }) {
  const ids = [...new Set(items.map((i) => i.product_id))];
  const products = await productRepository.findByIds(ids);

  const payloadError = validatePayload(items, products);
  if (payloadError) {
    const e = new Error(payloadError);
    e.status = 400;
    throw e;
  }

  // 3. R1 LAYER 1 — pre-check stok (TIDAK PERLU const ids lagi di sini)
  const failures = ruleEngine.checkR1StockAvailability({ items, products });

  if (failures.length > 0) {
    const productMap = new Map(products.map((p) => [p.id, p]));

    // Tulis stock_logs REJECTED untuk SETIAP item yang gagal R1
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
        context_payload: {
          attempted_items: items,
          failure: f,
        },
      });
    }

    const e = new Error(failures.map((f) => f.reason).join("; "));
    e.status = 409;
    e.rule = "R1";
    e.failures = failures;
    throw e;
  }

  const kodeTransaksi = await nextDocumentNumber("sale");
  const productMap = new Map(products.map((p) => [p.id, p]));

  // Harga diambil dari DB, bukan dari request — mencegah manipulasi harga
  const secureItems = items.map((it) => {
    const dbProduct = productMap.get(it.product_id);
    const diskonNum = Number(it.diskon_persen || 0);
    const diskon = Number.isFinite(diskonNum)
      ? Math.max(0, Math.min(100, diskonNum))
      : 0;
    return {
      product_id: it.product_id,
      qty: it.qty,
      harga_satuan: dbProduct.harga_jual,
      diskon_persen: diskon,
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

    if (mapped.rule === "R1") {
      await stockLogRepository.write({
        product_id: null,
        user_id: user.id,
        source_type: "sales",
        rule_triggered: "R1",
        rule_action: "REJECTED",
        reason_detail: `Race condition R1 di trigger DB: ${mapped.message}`,
        context_payload: { kode_transaksi: kodeTransaksi, items },
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
        context_payload: { kode_transaksi: kodeTransaksi, items },
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
    console.warn(
      `[POS-SALES] getReceipt gagal untuk sale_id=${rpcResult.sale_id}, return minimal response`
    );
    receipt = {
      id: rpcResult.sale_id,
      kode_transaksi: kodeTransaksi,
      total_harga: rpcResult.total_harga,
      kasir: user.username,
      items: [], // Items kosong karena gagal fetch
    };
  }

  console.log(
    `[POS-SALES] Transaksi ${receipt.kode_transaksi} sukses oleh user=${user.username} total=${receipt.total_harga}`
  );
  return receipt;
}

async function listSales(filter) {
  return salesRepository.list(filter);
}

module.exports = { createSale, listSales };
