const supabase = require("../config/supabase");

function toEndOfDay(dateStr) {
  if (!dateStr) return null;
  return dateStr.includes("T") ? dateStr : dateStr + "T23:59:59.999Z";
}

function toStartOfDay(dateStr) {
  if (!dateStr) return null;
  return dateStr.includes("T") ? dateStr : dateStr + "T00:00:00.000Z";
}

// Sales report — query dari tabel sales dulu (filter tanggal di sini), lalu join items
async function listSalesReport({ from = null, to = null, limit = 5000, userId = null }) {
  let query = supabase
    .from("sales")
    .select(
      "id, kode_transaksi, total_harga, created_at, user_id, users(username), sale_items(id, qty, harga_satuan, diskon_persen, subtotal, product_id, products(kode_barang, nama_barang, merk))"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (userId) query = query.eq("user_id", userId);
  if (from) query = query.gte("created_at", toStartOfDay(from));
  if (to) query = query.lte("created_at", toEndOfDay(to));

  const { data, error } = await query;
  if (error) {
    console.error("[POS-REPORT] sales query error:", error.message, error.details);
    throw new Error("Gagal memuat laporan penjualan");
  }

  const rows = [];
  for (const sale of data || []) {
    for (const item of sale.sale_items || []) {
      rows.push({
        sale_item_id: item.id,
        sale_id: sale.id,
        kode_transaksi: sale.kode_transaksi,
        sale_created_at: sale.created_at,
        sale_total: Number(sale.total_harga || 0),
        kasir: sale.users?.username || null,
        product_id: item.product_id,
        kode_barang: item.products?.kode_barang,
        nama_barang: item.products?.nama_barang,
        merk: item.products?.merk,
        qty: item.qty,
        harga_satuan: Number(item.harga_satuan),
        diskon_persen: Number(item.diskon_persen || 0),
        subtotal: Number(item.subtotal),
      });
    }
  }
  return rows;
}

// Purchase report — query dari tabel purchases dulu, lalu join items
async function listPurchaseReport({ from = null, to = null, limit = 5000 }) {
  let query = supabase
    .from("purchases")
    .select(
      "id, no_nota_supplier, status_validasi, total, diskon_persen, potongan_harga, created_at, user_id, users(username), purchase_items(id, qty, harga_beli, diskon_persen, source, product_id, products(kode_barang, nama_barang, merk))"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (from) query = query.gte("created_at", toStartOfDay(from));
  if (to) query = query.lte("created_at", toEndOfDay(to));

  const { data, error } = await query;
  if (error) {
    console.error("[POS-REPORT] purchases query error:", error.message, error.details);
    throw new Error("Gagal memuat laporan pembelian");
  }

  const rows = [];
  for (const purchase of data || []) {
    const purchaseTotal = Number(purchase.total || 0);
    const notaDiskonPersen = Number(purchase.diskon_persen || 0);
    const notaPotonganHarga = Number(purchase.potongan_harga || 0);
    let itemsSum = 0;
    const items = purchase.purchase_items || [];
    for (const item of items) {
      const harga = Number(item.harga_beli);
      const qty = Number(item.qty);
      const diskon = Number(item.diskon_persen);
      itemsSum += harga * qty * (1 - diskon / 100);
    }
    const diskonNilai = notaDiskonPersen > 0 || notaPotonganHarga > 0
      ? Math.round(itemsSum * notaDiskonPersen / 100) + notaPotonganHarga
      : Math.max(0, Math.round((itemsSum - purchaseTotal) * 100) / 100);

    for (const item of items) {
      const harga = Number(item.harga_beli);
      const qty = Number(item.qty);
      const diskon = Number(item.diskon_persen);
      rows.push({
        purchase_item_id: item.id,
        purchase_id: purchase.id,
        no_nota: purchase.no_nota_supplier,
        purchase_created_at: purchase.created_at,
        purchase_total: purchaseTotal,
        nota_diskon_persen: notaDiskonPersen,
        nota_potongan_harga: notaPotonganHarga,
        diskon_nilai: diskonNilai,
        status_validasi: purchase.status_validasi,
        user: purchase.users?.username || null,
        product_id: item.product_id,
        kode_barang: item.products?.kode_barang,
        nama_barang: item.products?.nama_barang,
        merk: item.products?.merk,
        qty,
        harga_beli: harga,
        diskon_persen: diskon,
        source: item.source,
        subtotal: harga * qty * (1 - diskon / 100),
      });
    }
  }
  return rows;
}

module.exports = { listSalesReport, listPurchaseReport };
