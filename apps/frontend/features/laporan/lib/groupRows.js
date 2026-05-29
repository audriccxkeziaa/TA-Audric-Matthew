// Util pengelompokan baris flat laporan → array per transaksi/nota dengan
// agregasi & items[]. Murni perhitungan, dipindahkan apa adanya dari page.jsx.

// Group flat rows by sale_id → { sale_id, ...aggregated, items[] }
export function groupSalesRows(rows) {
  const map = new Map();
  for (const r of rows) {
    const key = r.sale_id;
    if (!map.has(key)) {
      map.set(key, {
        sale_id: r.sale_id,
        kode_transaksi: r.kode_transaksi,
        created_at: r.sale_created_at,
        kasir: r.kasir,
        total: 0,
        total_qty: 0,
        item_count: 0,
        items: [],
      });
    }
    const g = map.get(key);
    g.total += Number(r.subtotal);
    g.total_qty += Number(r.qty);
    g.item_count += 1;
    g.items.push(r);
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );
}

export function groupPurchaseRows(rows) {
  const map = new Map();
  for (const r of rows) {
    const key = r.purchase_id;
    if (!map.has(key)) {
      map.set(key, {
        purchase_id: r.purchase_id,
        no_nota: r.no_nota,
        created_at: r.purchase_created_at,
        user: r.user,
        status_validasi: r.status_validasi,
        nota_diskon_persen: Number(r.nota_diskon_persen || 0),
        nota_potongan_harga: Number(r.nota_potongan_harga || 0),
        diskon_nilai: Number(r.diskon_nilai || 0),
        subtotal_before_diskon: 0,
        total: 0,
        total_qty: 0,
        item_count: 0,
        items: [],
      });
    }
    const g = map.get(key);
    g.subtotal_before_diskon += Number(r.subtotal);
    g.total = g.subtotal_before_diskon - g.diskon_nilai;
    g.total_qty += Number(r.qty);
    g.item_count += 1;
    g.items.push(r);
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );
}
