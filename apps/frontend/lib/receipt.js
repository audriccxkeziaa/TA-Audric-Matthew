// =================================================================
// lib/receipt.js — Cetak struk transaksi ke jendela baru
// =================================================================
// Lebar 80mm thermal printer (~302px pada 96dpi).
// @media print mengatur ukuran kertas 80mm × continuous.
// =================================================================

import { rupiah, tanggalJam } from "./format";

export function printReceipt(receipt) {
  if (typeof window === "undefined") return;

  const rows = (receipt.items || [])
    .map(
      (it) => `
      <tr>
        <td class="item-name" colspan="3">${escapeHtml(it.nama_barang || "")}</td>
      </tr>
      <tr>
        <td class="item-detail">${it.qty} x ${rupiah(it.harga_satuan)}</td>
        <td></td>
        <td class="item-subtotal">${rupiah(it.subtotal)}</td>
      </tr>`
    )
    .join("");

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
<style>
  @page {
    size: 80mm auto;
    margin: 0;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Courier New', 'Consolas', monospace;
    width: 80mm;
    max-width: 80mm;
    margin: 0 auto;
    padding: 3mm 4mm;
    color: #000;
    font-size: 9pt;
    line-height: 1.3;
    -webkit-print-color-adjust: exact;
  }
  .header { text-align: center; margin-bottom: 2mm; }
  .shop-name { font-size: 12pt; font-weight: bold; }
  .shop-sub { font-size: 8pt; }
  .divider {
    border: none;
    border-top: 1px dashed #000;
    margin: 2mm 0;
  }
  .meta { font-size: 8pt; }
  .meta td { padding: 0.5mm 0; }
  .meta .label { width: 22mm; }
  table.items { width: 100%; border-collapse: collapse; margin: 1mm 0; }
  .items .item-name { font-size: 8.5pt; font-weight: bold; padding-top: 1.5mm; }
  .items .item-detail { font-size: 8pt; padding-left: 3mm; color: #333; }
  .items .item-subtotal { font-size: 8pt; text-align: right; }
  table.totals { width: 100%; border-collapse: collapse; font-size: 9pt; }
  .totals td { padding: 0.5mm 0; }
  .totals .val { text-align: right; }
  .totals .grand { font-size: 11pt; font-weight: bold; border-top: 1px solid #000; padding-top: 1mm; }
  .footer { text-align: center; font-size: 7.5pt; margin-top: 3mm; color: #333; }
  @media screen {
    body { border: 1px solid #ccc; background: #fff; margin-top: 10px; }
  }
</style></head><body>

  <div class="header">
    <div class="shop-name">CV ASIA JAYA MAJU</div>
    <div class="shop-sub">Suku Cadang Sepeda Motor</div>
  </div>

  <hr class="divider"/>

  <table class="meta">
    <tr><td class="label">No</td><td>: ${escapeHtml(receipt.kode_transaksi || "")}</td></tr>
    <tr><td class="label">Tanggal</td><td>: ${tanggalJam(receipt.created_at)}</td></tr>
    ${kasir ? `<tr><td class="label">Kasir</td><td>: ${escapeHtml(kasir)}</td></tr>` : ""}
  </table>

  <hr class="divider"/>

  <table class="items">${rows}</table>

  <hr class="divider"/>

  <table class="totals">
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

  const w = window.open("", "_blank", "width=340,height=600");
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
