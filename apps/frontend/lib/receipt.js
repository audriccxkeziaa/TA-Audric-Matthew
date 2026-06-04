// lib/receipt.js — Cetak struk transaksi ke jendela baru
// Lebar 80mm thermal printer (~302px pada 96dpi).
// @media print mengatur ukuran kertas 80mm × continuous.

import { rupiah } from "./format";

// CSS struk dipakai bersama oleh printReceipt & printReturnReceipt supaya
// format 100% seragam. Dituning agar TAJAM saat dicetak ke thermal:
//   - font lebih besar (10pt) + Consolas (lebih bersih dari Courier New)
//   - teks detail/footer hitam pekat (#000), bukan abu — abu menjadi blur/dither
//   - print-color-adjust: exact + geometricPrecision biar tidak di-antialias pudar
const RECEIPT_CSS = `
  @page { size: 80mm auto; margin: 3mm 5mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Consolas', 'Courier New', monospace;
    width: 70mm;
    max-width: 70mm;
    margin: 0 auto;
    padding: 0;
    color: #000;
    font-size: 10pt;
    line-height: 1.35;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    text-rendering: geometricPrecision;
  }
  .header { text-align: center; margin-bottom: 2mm; }
  .shop-name { font-size: 13pt; font-weight: bold; }
  .shop-sub { font-size: 9pt; }
  .shop-addr { font-size: 8pt; line-height: 1.4; }
  .type-label { font-size: 11pt; font-weight: bold; text-align: center; letter-spacing: 1px; margin: 1.5mm 0; }
  .divider { border: none; border-top: 1px dashed #000; margin: 2mm 0; }
  .meta { font-size: 9pt; }
  .meta td { padding: 0.5mm 0; }
  .meta .label { width: 22mm; }
  table.items { width: 100%; border-collapse: collapse; margin: 1mm 0; }
  .items .item-name { font-size: 9.5pt; font-weight: bold; padding-top: 1.5mm; }
  .items .item-detail { font-size: 9pt; padding-left: 3mm; color: #000; }
  .items .item-subtotal { font-size: 9pt; text-align: right; }
  table.totals { width: 100%; border-collapse: collapse; font-size: 10pt; }
  .totals td { padding: 0.5mm 0; }
  .totals .val { text-align: right; }
  .totals .grand { font-size: 12pt; font-weight: bold; border-top: 1px solid #000; padding-top: 1mm; }
  .footer { text-align: center; font-size: 8pt; margin-top: 3mm; color: #000; }
  @media screen {
    body { width: 80mm; max-width: 80mm; padding: 3mm 4mm; border: 1px solid #ccc; background: #fff; margin-top: 10px; }
  }
`;

// Waktu WITA (UTC+8) eksplisit untuk struk cetak, agar akurat di seluruh zona WITA.
function tanggalJamWita(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("id-ID", {
    timeZone: "Asia/Makassar",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function printReceipt(receipt) {
  if (typeof window === "undefined") return;

  const rows = (receipt.items || [])
    .map((it) => {
      const disc = Number(it.diskon_persen) || 0;
      const detail =
        `${it.qty} x ${rupiah(it.harga_satuan)}` +
        (disc > 0 ? ` (disk ${disc}%)` : "");
      return `
      <tr>
        <td class="item-name" colspan="3">${escapeHtml(it.nama_barang || "")}</td>
      </tr>
      <tr>
        <td class="item-detail">${detail}</td>
        <td></td>
        <td class="item-subtotal">${rupiah(it.subtotal)}</td>
      </tr>`;
    })
    .join("");

  // Ringkasan diskon: subtotal kotor (Σ qty×harga) vs total setelah diskon per item.
  const grossTotal = (receipt.items || []).reduce(
    (s, it) => s + Number(it.qty) * Number(it.harga_satuan),
    0
  );
  const totalDiskon = Math.max(0, grossTotal - Number(receipt.total_harga || 0));

  const tunai = receipt.tunai ? `
    <tr>
      <td>Tunai</td><td></td>
      <td class="val">${rupiah(receipt.tunai)}</td>
    </tr>
    <tr>
      <td>Kembali</td><td></td>
      <td class="val">${rupiah(receipt.kembalian || (receipt.tunai - receipt.total_harga))}</td>
    </tr>` : "";

  const kasir = receipt.kasir || receipt.user?.username || "";

  const html = `<!DOCTYPE html>
<html lang="id"><head><meta charset="utf-8"/>
<title>Struk ${escapeHtml(receipt.kode_transaksi || "")}</title>
<style>${RECEIPT_CSS}</style></head><body>

  <div class="header">
    <div class="shop-name">CV ASIA JAYA MAJU</div>
    <div class="shop-sub">Suku Cadang Sepeda Motor</div>
    <div class="shop-addr">Jl. A. Yani KM 34 No. 56, Loktabat Selatan</div>
    <div class="shop-addr">Banjarbaru, Kalsel 70714</div>
    <div class="shop-addr">No. Telp: 0851-0262-6289</div>
  </div>

  <hr class="divider"/>

  <table class="meta">
    <tr><td class="label">No</td><td>: ${escapeHtml(receipt.kode_transaksi || "")}</td></tr>
    <tr><td class="label">Tanggal</td><td>: ${tanggalJamWita(receipt.created_at)}</td></tr>
    ${kasir ? `<tr><td class="label">Kasir</td><td>: ${escapeHtml(kasir)}</td></tr>` : ""}
  </table>

  <hr class="divider"/>

  <table class="items">${rows}</table>

  <hr class="divider"/>

  <table class="totals">
    ${totalDiskon > 0 ? `
    <tr>
      <td>Subtotal</td><td></td>
      <td class="val">${rupiah(grossTotal)}</td>
    </tr>
    <tr>
      <td>Diskon</td><td></td>
      <td class="val">-${rupiah(totalDiskon)}</td>
    </tr>` : ""}
    <tr class="grand">
      <td>TOTAL</td><td></td>
      <td class="val">${rupiah(receipt.total_harga)}</td>
    </tr>
    ${tunai}
  </table>

  <hr class="divider"/>

  <div class="footer">
    Terima kasih atas kunjungan Anda<br/>
    Barang yang sudah dibeli tidak dapat ditukar/dikembalikan
  </div>

  <script>window.onload = function(){ window.print(); }</script>
</body></html>`;

  const w = window.open("", "_blank", "width=400,height=650");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

export function printReturnReceipt(detail) {
  if (typeof window === "undefined") return;

  const typeLabel = {
    sales_return:     "RETUR PELANGGAN",
    return_supplier:  "RETUR SUPPLIER",
    stock_adjustment: "PENYESUAIAN STOK",
  }[detail.type] || "RETUR";

  const rows = (detail.items || [])
    .map(
      (it) => `
      <tr>
        <td class="item-name" colspan="3">${escapeHtml(it.nama_barang || "")}</td>
      </tr>
      <tr>
        <td class="item-detail">${it.qty} x ${rupiah(it.harga_satuan)}</td>
        <td></td>
        <td class="item-subtotal">${rupiah(Number(it.qty) * Number(it.harga_satuan))}</td>
      </tr>`
    )
    .join("");

  const totalNilai = (detail.items || []).reduce(
    (s, it) => s + Number(it.qty) * Number(it.harga_satuan),
    0
  );

  const html = `<!DOCTYPE html>
<html lang="id"><head><meta charset="utf-8"/>
<title>Struk ${escapeHtml(detail.kode_adjustment || "")}</title>
<style>${RECEIPT_CSS}</style></head><body>

  <div class="header">
    <div class="shop-name">CV ASIA JAYA MAJU</div>
    <div class="shop-sub">Suku Cadang Sepeda Motor</div>
    <div class="shop-addr">Jl. A. Yani KM 34 No. 56, Loktabat Selatan</div>
    <div class="shop-addr">Banjarbaru, Kalsel 70714</div>
    <div class="shop-addr">No. Telp: 0851-0262-6289</div>
  </div>

  <div class="type-label">— ${typeLabel} —</div>

  <hr class="divider"/>

  <table class="meta">
    <tr><td class="label">No</td><td>: ${escapeHtml(detail.kode_adjustment || "")}</td></tr>
    <tr><td class="label">Tanggal</td><td>: ${tanggalJamWita(detail.created_at)}</td></tr>
    ${detail.supplier_name ? `<tr><td class="label">Supplier</td><td>: ${escapeHtml(detail.supplier_name)}</td></tr>` : ""}
    ${detail.username ? `<tr><td class="label">User</td><td>: ${escapeHtml(detail.username)}</td></tr>` : ""}
    ${detail.alasan ? `<tr><td class="label">Alasan</td><td>: ${escapeHtml(detail.alasan)}</td></tr>` : ""}
  </table>

  <hr class="divider"/>

  <table class="items">${rows}</table>

  <hr class="divider"/>

  <table class="totals">
    <tr class="grand">
      <td>TOTAL NILAI</td><td></td>
      <td class="val">${rupiah(totalNilai)}</td>
    </tr>
  </table>

  <hr class="divider"/>

  <div class="footer">
    Dokumen resmi retur — CV Asia Jaya Maju<br/>
    Sistem POS Suku Cadang Sepeda Motor
  </div>

  <script>window.onload = function(){ window.print(); }</script>
</body></html>`;

  const w = window.open("", "_blank", "width=400,height=650");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}
