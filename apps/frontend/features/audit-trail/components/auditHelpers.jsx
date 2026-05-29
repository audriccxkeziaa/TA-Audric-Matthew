// Helper presentasi audit trail (badge, label sumber, terjemahan alasan,
// dan tabel payload forensik). Dipindahkan apa adanya dari page.jsx — murni
// fungsi tampilan, tanpa logika bisnis.

import { Badge } from "@/components/ui";
import { tanggalJam, rupiah } from "@/lib/format";

export function ruleBadge(rule) {
  if (!rule) return <span className="text-slate-300">—</span>;
  const tone = rule === "R1" ? "red" : rule === "R3" ? "amber" : "indigo";
  return <Badge tone={tone}>{rule}</Badge>;
}

export function actionBadge(action) {
  const tone =
    action === "REJECTED"
      ? "red"
      : action === "TRIGGERED"
      ? "amber"
      : "green";
  return <Badge tone={tone}>{action}</Badge>;
}

export function humanSource(src) {
  if (src === "sales") return "Penjualan";
  if (src === "purchase") return "Stok Masuk";
  if (src === "manual") return "Manual";
  if (src === "adjustment") return "Retur/Penyesuaian";
  return src || "—";
}

export function humanReason(row) {
  const r = row.reason_detail || "";
  if (r.includes("trigger R4") && row.source_type === "sales")
    return "Stok berkurang karena penjualan";
  if (r.includes("trigger R4") && row.source_type === "purchase")
    return "Stok bertambah karena stok masuk dari supplier";
  if (r.includes("Race condition R1"))
    return "Transaksi ditolak — stok tidak cukup (terdeteksi saat proses)";
  if (row.rule_triggered === "R1" && row.rule_action === "REJECTED")
    return `Transaksi ditolak — stok tidak cukup untuk jumlah yang diminta`;
  if (row.rule_triggered === "R2" && row.rule_action === "REJECTED")
    return "Stok masuk ditolak — data belum divalidasi oleh kasir";
  if (row.rule_triggered === "R3")
    return "Percobaan mengubah stok secara langsung ditolak oleh sistem";
  return r || "—";
}

const FIELD_LABELS = {
  qty: "Jumlah", harga_beli: "Harga Beli", harga_jual: "Harga Jual",
  diskon_persen: "Diskon", source: "Input Via", kode_transaksi: "Kode Transaksi",
  kode_barang: "Kode Barang", nama_barang: "Nama Barang", merk: "Merk",
  stok: "Stok", min_stock: "Min. Stok", status: "Status",
  changed_by: "Diubah Oleh", alasan: "Alasan", edited_at: "Waktu Edit",
};
const SKIP_KEYS = ["sale_id", "sale_item_id", "purchase_id", "purchase_item_id", "id", "created_at", "updated_at"];

function formatField(k, v) {
  if (v === null || v === undefined) return "—";
  if ((k === "harga_beli" || k === "harga_jual") && typeof v === "number") return rupiah(v);
  if (k === "diskon_persen") return `${v}%`;
  if (k === "source") return v === "ocr" ? "OCR" : v === "manual" ? "Manual" : v;
  if (k === "edited_at" && typeof v === "string") return tanggalJam(v);
  return String(v);
}

function renderPayloadObject(obj, label) {
  if (!obj || typeof obj !== "object") return null;
  const entries = Object.entries(obj).filter(([k]) => !SKIP_KEYS.includes(k));
  if (entries.length === 0) return null;
  return (
    <div className="mt-2">
      {label && <p className="mb-1 text-xs font-medium text-slate-500">{label}</p>}
      <table className="w-full text-sm">
        <tbody className="divide-y divide-slate-100">
          {entries.map(([k, v]) => (
            <tr key={k}>
              <td className="py-1 pr-3 text-xs text-slate-500 whitespace-nowrap w-1/3">
                {FIELD_LABELS[k] || k}
              </td>
              <td className="py-1 text-xs font-medium text-slate-800">
                {typeof v === "object" ? JSON.stringify(v) : formatField(k, v)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ContextPayloadTable({ payload }) {
  if (!payload || typeof payload !== "object") return null;

  if (payload.before && payload.after) {
    const beforeEntries = Object.entries(payload.before).filter(([k]) => !SKIP_KEYS.includes(k));
    const changed = beforeEntries.filter(([k]) => {
      const bv = payload.before[k];
      const av = payload.after[k];
      return String(bv) !== String(av);
    });
    return (
      <div className="mt-2 space-y-2">
        {payload.alasan && (
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <b>Alasan edit:</b> {payload.alasan}
          </div>
        )}
        {payload.changed_by && (
          <p className="text-xs text-slate-500">Oleh: <b>{payload.changed_by}</b> · {payload.edited_at ? tanggalJam(payload.edited_at) : ""}</p>
        )}
        {changed.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-400">
                <th className="py-1 text-left font-medium">Field</th>
                <th className="py-1 text-left font-medium">Sebelum</th>
                <th className="py-1 text-left font-medium">Sesudah</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {changed.map(([k]) => (
                <tr key={k}>
                  <td className="py-1 text-xs text-slate-500">{FIELD_LABELS[k] || k}</td>
                  <td className="py-1 text-xs text-red-600">{formatField(k, payload.before[k])}</td>
                  <td className="py-1 text-xs text-emerald-600 font-medium">{formatField(k, payload.after[k])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  }

  const entries = Object.entries(payload).filter(
    ([k, v]) => !SKIP_KEYS.includes(k) && typeof v !== "object"
  );
  if (entries.length === 0) return null;
  return renderPayloadObject(payload, null);
}
