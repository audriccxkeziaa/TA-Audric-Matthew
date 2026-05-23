// =================================================================
// lib/receipt.js — Cetak struk transaksi ke jendela baru
// =================================================================
// Membuka window terpisah berisi HTML struk lalu memanggil print().
// Dipisah supaya isi struk tidak terganggu layout aplikasi.
// =================================================================

import { rupiah, tanggalJam } from "./format";

export function printReceipt(receipt) {
  if (typeof window === "undefined") return;
  const rows = (receipt.items || [])
    .map(
      (it) => `
      <tr>
        <td>${escapeHtml(it.nama_barang || "")}<br/>
          <small>${it.qty} x ${rupiah(it.harga_satuan)}</small>
        </td>
        <td style="text-align:right">${rupiah(it.subtotal)}</td>
      </tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="id"><head><meta charset="utf-8"/>
<title>Struk ${escapeHtml(receipt.kode_transaksi || "")}</title>
<style>
  body { font-family: monospace; width: 280px; margin: 0 auto; padding: 12px; color:#000; }
  h2 { text-align:center; margin:0; font-size:14px; }
  .sub { text-align:center; font-size:11px; margin-bottom:8px; }
  hr { border:none; border-top:1px dashed #000; }
  table { width:100%; border-collapse:collapse; font-size:11px; }
  td { padding:3px 0; vertical-align:top; }
  .total { font-weight:bold; font-size:13px; }
  .foot { text-align:center; font-size:10px; margin-top:10px; }
</style></head><body>
  <h2>CV ASIA JAYA MAJU</h2>
  <div class="sub">Suku Cadang Sepeda Motor</div>
  <hr/>
  <div style="font-size:11px">
    No: ${escapeHtml(receipt.kode_transaksi || "")}<br/>
    Tanggal: ${tanggalJam(receipt.created_at)}
  </div>
  <hr/>
  <table>${rows}</table>
  <hr/>
  <table><tr class="total">
    <td>TOTAL</td>
    <td style="text-align:right">${rupiah(receipt.total_harga)}</td>
  </tr></table>
  <hr/>
  <div class="foot">Terima kasih atas kunjungan Anda.<br/>Barang yang sudah dibeli tidak dapat ditukar.</div>
  <script>window.onload = function(){ window.print(); }</script>
</body></html>`;

  const w = window.open("", "_blank", "width=320,height=600");
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
