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
import { useToast } from "@/hooks/useToast";
import { tanggalJam, isoDate } from "@/lib/format";
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

export default function AuditTrailPage() {
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
        description="Jejak setiap perubahan & penolakan stok oleh Rule-Based System."
        actions={
          <Button variant="outline" onClick={exportCsv}>
            Export CSV
          </Button>
        }
      />

      {/* Filter — selalu terlihat */}
      <Card className="mb-3 shrink-0 p-3">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
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
      <Card className="flex min-h-0 flex-1 flex-col p-0">
        {isLoading ? (
          <div className="p-6">
            <Spinner label="Memuat audit log..." />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState title="Tidak ada catatan audit untuk filter ini" />
        ) : (
          <div className="min-h-0 flex-1 overflow-auto thin-scroll">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2.5">Waktu</th>
                  <th className="px-3 py-2.5">User</th>
                  <th className="px-3 py-2.5">Barang</th>
                  <th className="px-3 py-2.5">Sumber</th>
                  <th className="px-3 py-2.5">Rule</th>
                  <th className="px-3 py-2.5">Aksi</th>
                  <th className="px-3 py-2.5 text-right">Δ Qty</th>
                  <th className="px-3 py-2.5">Alasan</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => setDetailRow(r)}
                    className="cursor-pointer hover:bg-slate-50"
                  >
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
                    <td className="px-3 py-2 capitalize">{r.source_type}</td>
                    <td className="px-3 py-2">{ruleBadge(r.rule_triggered)}</td>
                    <td className="px-3 py-2">{actionBadge(r.rule_action)}</td>
                    <td className="px-3 py-2 text-right font-semibold">
                      {r.delta_qty > 0 ? `+${r.delta_qty}` : r.delta_qty}
                    </td>
                    <td className="px-3 py-2 max-w-xs">
                      <span className="line-clamp-2 text-xs text-slate-600">
                        {r.reason_detail || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-xs text-brand-600">Detail →</span>
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
          {total} catatan · halaman {page}/{totalPages}
          {isFetching && " · memuat..."}
        </span>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Sebelumnya
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Berikutnya
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
                <p className="capitalize">{detailRow.source_type}</p>
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
                {detailRow.reason_detail || "—"}
              </p>
            </div>

            <div>
              <p className="text-xs uppercase text-slate-400">
                Context Payload (forensik)
              </p>
              <pre className="mt-1 max-h-64 overflow-auto thin-scroll rounded bg-slate-50 p-2 text-[11px] text-slate-600">
                {JSON.stringify(detailRow.context_payload, null, 2) || "—"}
              </pre>
            </div>
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
