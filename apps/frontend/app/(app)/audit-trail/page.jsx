"use client";
// =================================================================
// /audit-trail — Audit Trail stock_logs (admin)
// =================================================================
// Bukti Rule-Based System bekerja: tiap perubahan/penolakan stok
// tercatat. Layout 1 layar: header/filter/pagination tetap terlihat,
// hanya tabel yang scroll di dalam panelnya.
// Detail forensik tiap baris tampil sebagai modal pop-up.
// =================================================================

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { auditApi, usersApi } from "@/lib/api";
import { downloadFile } from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { tanggalJam, isoDate, rupiah } from "@/lib/format";
import ProductPicker from "@/components/ProductPicker";
import {
  PageShell,
  PageHeader,
  Card,
  Button,
  Input,
  Select,
  Badge,
  Modal,
  Spinner,
  EmptyState,
} from "@/components/ui";

function ruleBadge(rule) {
  if (!rule) return <span className="text-slate-300">—</span>;
  const tone = rule === "R1" ? "red" : rule === "R3" ? "amber" : "indigo";
  return <Badge tone={tone}>{rule}</Badge>;
}
function actionBadge(action) {
  const tone =
    action === "REJECTED"
      ? "red"
      : action === "TRIGGERED"
      ? "amber"
      : "green";
  return <Badge tone={tone}>{action}</Badge>;
}

function humanSource(src) {
  if (src === "sales") return "Penjualan";
  if (src === "purchase") return "Stok Masuk";
  if (src === "manual") return "Manual";
  return src || "—";
}

function humanReason(row) {
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

function ContextPayloadTable({ payload }) {
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

export default function AuditTrailPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [filters, setFilters] = useState({
    from: "",
    to: "",
    user_id: "",
    product_id: "",
    rule: "",
    action: "",
    source_type: "",
  });
  const [productLabel, setProductLabel] = useState("");
  const [page, setPage] = useState(1);
  const [openPicker, setOpenPicker] = useState(false);
  const [detailRow, setDetailRow] = useState(null);

  const pageSize = 50;

  const usersQ = useQuery({ queryKey: ["users"], queryFn: usersApi.list });
  const users = usersQ.data?.data || [];

  const query = { ...filters, page, page_size: pageSize };
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["audit", query],
    queryFn: () => auditApi.list(query),
  });
  const rows = data?.rows || [];
  const totalPages = data?.total_pages || 1;
  const total = data?.total || 0;

  function setFilter(field, value) {
    setFilters((f) => ({ ...f, [field]: value }));
    setPage(1);
  }

  async function exportCsv() {
    try {
      await downloadFile("/audit-logs", {
        query: { ...filters, format: "csv" },
        filename: `audit-trail_${isoDate()}.csv`,
      });
      toast.success("CSV diunduh");
    } catch (e) {
      toast.error(e.message || "Gagal mengunduh CSV");
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Audit Trail"
        description="Berisi detail setiap aksi & perubahan yang dilakukan oleh admin dan kasir."
        actions={
          <Button variant="outline" onClick={exportCsv}>
            Export CSV
          </Button>
        }
      />

      {/* Filter — selalu terlihat */}
      <Card className="mb-3 shrink-0 p-3">
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          <Input
            label="Dari Tanggal"
            type="date"
            value={filters.from}
            onChange={(e) => setFilter("from", e.target.value)}
          />
          <Input
            label="Sampai Tanggal"
            type="date"
            value={filters.to}
            onChange={(e) => setFilter("to", e.target.value)}
          />
          <Select
            label="User"
            value={filters.user_id}
            onChange={(e) => setFilter("user_id", e.target.value)}
          >
            <option value="">Semua user</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.username} ({u.role})
              </option>
            ))}
          </Select>
          <Select
            label="Rule"
            value={filters.rule}
            onChange={(e) => setFilter("rule", e.target.value)}
          >
            <option value="">Semua rule</option>
            <option value="R1">R1 — Stok Negatif</option>
            <option value="R2">R2 — Validasi Stok Masuk</option>
            <option value="R3">R3 — Stok Terpusat</option>
            <option value="R4">R4 — Konsistensi Stok</option>
            <option value="R5">R5 — Rekomendasi Restock</option>
          </Select>
          <Select
            label="Aksi"
            value={filters.action}
            onChange={(e) => setFilter("action", e.target.value)}
          >
            <option value="">Semua aksi</option>
            <option value="TRIGGERED">TRIGGERED</option>
            <option value="REJECTED">REJECTED</option>
            <option value="ACCEPTED">ACCEPTED</option>
          </Select>
          <Select
            label="Sumber"
            value={filters.source_type}
            onChange={(e) => setFilter("source_type", e.target.value)}
          >
            <option value="">Semua sumber</option>
            <option value="sales">Penjualan</option>
            <option value="purchase">Stok Masuk</option>
            <option value="manual">Manual</option>
          </Select>
          <div>
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Produk
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="md"
                className="flex-1"
                onClick={() => setOpenPicker(true)}
              >
                {productLabel || "Semua produk"}
              </Button>
              {filters.product_id && (
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => {
                    setFilter("product_id", "");
                    setProductLabel("");
                  }}
                >
                  ✕
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Tabel — mengisi sisa tinggi */}
      <Card className="flex flex-col p-0 md:min-h-0 md:flex-1">
        {isLoading ? (
          <div className="p-6">
            <Spinner label="Memuat audit log..." />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState title="Tidak ada catatan audit untuk filter ini" />
        ) : (
          <div className="overflow-auto thin-scroll md:min-h-0 md:flex-1">
            <table className="w-full min-w-[700px] text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2.5 w-8">No</th>
                  <th className="px-3 py-2.5">Waktu</th>
                  <th className="px-3 py-2.5">User</th>
                  <th className="px-3 py-2.5">Barang</th>
                  <th className="px-3 py-2.5">Sumber</th>
                  <th className="px-3 py-2.5">Rule</th>
                  <th className="px-3 py-2.5">Aksi</th>
                  <th className="px-3 py-2.5 text-right">Δ Qty</th>
                  <th className="px-3 py-2.5">Alasan</th>
                  <th className="px-3 py-2.5 text-center">Aksi</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r, index) => (
                  <tr
                    key={r.id}
                    onClick={() => setDetailRow(r)}
                    className="cursor-pointer hover:bg-slate-50"
                  >
                    {/* TAMBAHKAN BARIS INI */}
                    <td className="px-3 py-2 text-xs text-slate-400">
                      {(page - 1) * pageSize + index + 1}
                    </td> 
                    <td className="px-3 py-2 whitespace-nowrap text-xs">
                      {tanggalJam(r.created_at)}
                    </td>
                    <td className="px-3 py-2">
                      {r.username || "—"}
                      {r.user_role && (
                        <span className="block text-xs text-slate-400">
                          {r.user_role}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {r.nama_barang || (
                        <span className="text-slate-300">(tanpa produk)</span>
                      )}
                      {r.kode_barang && (
                        <span className="block font-mono text-xs text-slate-400">
                          {r.kode_barang}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">{humanSource(r.source_type)}</td>
                    <td className="px-3 py-2">{ruleBadge(r.rule_triggered)}</td>
                    <td className="px-3 py-2">{actionBadge(r.rule_action)}</td>
                    <td className="px-3 py-2 text-right font-semibold">
                      {r.delta_qty > 0 ? `+${r.delta_qty}` : r.delta_qty}
                    </td>
                    <td className="px-3 py-2 max-w-xs">
                      <span className="line-clamp-2 text-xs text-slate-600">
                        {humanReason(r)}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => setDetailRow(r)}
                        className="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-slate-100 transition"
                        title="Lihat detail"
                      >
                        <svg className="w-4 h-4 text-slate-600 hover:text-brand-600" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 5C7 5 2.73 8.11 1 12.46c1.73 4.35 6 7.54 11 7.54s9.27-3.19 11-7.54C21.27 8.11 17 5 12 5zm0 12.5c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Pagination — selalu terlihat */}
      <div className="mt-2 flex shrink-0 items-center justify-between text-sm text-slate-500">
        <span>
          {total} items · page {page}/{totalPages}
          {isFetching && " · memuat..."}
        </span>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>

      {/* Modal detail forensik */}
      <Modal
        open={Boolean(detailRow)}
        onClose={() => setDetailRow(null)}
        title="Detail Audit Log"
        width="max-w-2xl"
      >
        {detailRow && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs uppercase text-slate-400">Waktu</p>
                <p>{tanggalJam(detailRow.created_at)}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-400">User</p>
                <p>
                  {detailRow.username || "—"}{" "}
                  <span className="text-slate-400">
                    ({detailRow.user_role || "—"})
                  </span>
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-400">Barang</p>
                <p>
                  {detailRow.nama_barang || "—"}
                  {detailRow.kode_barang && (
                    <span className="block font-mono text-xs text-slate-400">
                      {detailRow.kode_barang}
                    </span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-400">Sumber</p>
                <p className="capitalize">{humanSource(detailRow.source_type)}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-400">Rule</p>
                <div className="mt-0.5">{ruleBadge(detailRow.rule_triggered)}</div>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-400">Aksi</p>
                <div className="mt-0.5">{actionBadge(detailRow.rule_action)}</div>
              </div>
            </div>

            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs uppercase text-slate-400">Perubahan Stok</p>
              <p className="mt-1 font-semibold">
                {detailRow.stok_sebelum ?? "—"}{" "}
                <span className="text-slate-400">→</span>{" "}
                {detailRow.stok_sesudah ?? "—"}
                <span className="ml-2 text-xs text-slate-500">
                  (Δ {detailRow.delta_qty > 0 ? "+" : ""}
                  {detailRow.delta_qty})
                </span>
              </p>
            </div>

            <div>
              <p className="text-xs uppercase text-slate-400">Alasan</p>
              <p className="mt-1 text-slate-700">
                {humanReason(detailRow) || "—"}
              </p>
            </div>

            {user?.role === "admin" && detailRow.context_payload && (
              <div className="mt-2 border-t border-slate-100 pt-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-red-500">
                  Detail Forensik (Admin)
                </span>
                <ContextPayloadTable payload={detailRow.context_payload} />
              </div>
            )}
          </div>
        )}
      </Modal>

      <ProductPicker
        open={openPicker}
        onClose={() => setOpenPicker(false)}
        onSelect={(p) => {
          setFilter("product_id", p.id);
          setProductLabel(p.nama_barang);
        }}
      />
    </PageShell>
  );
}
