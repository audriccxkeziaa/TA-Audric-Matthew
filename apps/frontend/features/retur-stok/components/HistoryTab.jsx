"use client";
// Tab "Riwayat" — semua retur & penyesuaian dengan filter tipe + paging + detail.

import { Card, Button, Badge, Modal, Spinner, EmptyState } from "@/components/ui";
import { rupiah, angka, tanggalJam } from "@/lib/format";
import { TYPE_BADGES, STATUS_BADGES } from "../lib/badges";
import { useHistory } from "../hooks/useHistory";

export function HistoryTab() {
  const h = useHistory();

  // Lazy-load saat pertama dibuka (dipertahankan apa adanya: dipicu saat render).
  if (!h.loaded && !h.loading) {
    h.load(h.filterType);
  }

  return (
    <>
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">Riwayat Retur & Penyesuaian</h3>
          <div className="flex gap-2">
            <select
              value={h.filterType}
              onChange={(e) => {
                h.setFilterType(e.target.value);
                h.load(e.target.value);
              }}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="">Semua Tipe</option>
              <option value="return_supplier">Retur Supplier</option>
              <option value="sales_return">Retur Pelanggan</option>
              <option value="stock_adjustment">Penyesuaian Stok</option>
            </select>
            <Button size="sm" variant="secondary" onClick={() => h.load(h.filterType)}>
              Refresh
            </Button>
          </div>
        </div>

        {h.loading && <Spinner label="Memuat riwayat..." />}

        {!h.loading && h.data.length === 0 && (
          <EmptyState title="Belum ada riwayat" description="Semua retur dan penyesuaian stok akan tercatat di sini" />
        )}

        {!h.loading && h.data.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-2">Kode</th>
                    <th className="py-2 pr-2">Tipe</th>
                    <th className="py-2 pr-2">Status</th>
                    <th className="py-2 pr-2">User</th>
                    <th className="py-2 pr-2">Alasan</th>
                    <th className="py-2 pr-2 text-right">Total Qty</th>
                    <th className="py-2 pr-2">Tanggal</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {h.pagedData.map((row) => {
                    const tb = TYPE_BADGES[row.type] || { label: row.type, tone: "slate" };
                    const sb = STATUS_BADGES[row.status] || { label: row.status, tone: "slate" };
                    return (
                      <tr key={row.id} className="border-b border-slate-100 transition-colors hover:bg-brand-50/40">
                        <td className="py-2 pr-2 font-mono text-xs">{row.kode_adjustment}</td>
                        <td className="py-2 pr-2">
                          <Badge tone={tb.tone}>{tb.label}</Badge>
                        </td>
                        <td className="py-2 pr-2">
                          <Badge tone={sb.tone}>{sb.label}</Badge>
                        </td>
                        <td className="py-2 pr-2">
                          <div>
                            <p className="text-xs">{row.username || "-"}</p>
                            {row.approved_by_username && row.approved_by_username !== row.username && (
                              <p className="text-xs text-slate-400">
                                {row.status === "approved" ? "Disetujui" : "Ditolak"}: {row.approved_by_username}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="py-2 pr-2 max-w-[200px] truncate" title={row.alasan}>
                          {row.alasan}
                        </td>
                        <td className="py-2 pr-2 text-right">{angka(row.total_qty)}</td>
                        <td className="py-2 pr-2 text-xs text-slate-500">{tanggalJam(row.created_at)}</td>
                        <td className="py-2">
                          <button
                            onClick={() => h.openDetail(row.id)}
                            className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-500 transition hover:bg-slate-100 hover:text-brand-600"
                            title="Lihat detail"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
              <p>{h.data.length} items · page {h.page}/{h.totalPages}</p>
              <div className="flex gap-1">
                <button
                  onClick={() => h.setPage((p) => Math.max(1, p - 1))}
                  disabled={h.page === 1}
                  className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium hover:bg-slate-50 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  onClick={() => h.setPage((p) => Math.min(h.totalPages, p + 1))}
                  disabled={h.page === h.totalPages}
                  className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium hover:bg-slate-50 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Detail Modal */}
      <Modal
        open={!!h.detail || h.detailLoading}
        onClose={() => h.setDetail(null)}
        title={h.detail ? `Detail ${h.detail.kode_adjustment}` : "Memuat..."}
        width="max-w-2xl"
      >
        {h.detailLoading && <Spinner label="Memuat detail..." />}
        {h.detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-slate-400">Tipe:</span>{" "}
                <Badge tone={TYPE_BADGES[h.detail.type]?.tone || "slate"}>
                  {TYPE_BADGES[h.detail.type]?.label || h.detail.type}
                </Badge>
              </div>
              <div>
                <span className="text-slate-400">Status:</span>{" "}
                <Badge tone={STATUS_BADGES[h.detail.status]?.tone || "slate"}>
                  {STATUS_BADGES[h.detail.status]?.label || h.detail.status}
                </Badge>
              </div>
              <div>
                <span className="text-slate-400">Dibuat oleh:</span>{" "}
                {h.detail.username || "-"}
              </div>
              <div>
                <span className="text-slate-400">Tanggal:</span>{" "}
                {tanggalJam(h.detail.created_at)}
              </div>
              {h.detail.approved_by_username && (
                <div>
                  <span className="text-slate-400">
                    {h.detail.status === "approved" ? "Disetujui" : "Ditolak"} oleh:
                  </span>{" "}
                  {h.detail.approved_by_username}
                </div>
              )}
              {h.detail.approved_at && (
                <div>
                  <span className="text-slate-400">Tanggal keputusan:</span>{" "}
                  {tanggalJam(h.detail.approved_at)}
                </div>
              )}
              <div className="col-span-2">
                <span className="text-slate-400">Total Qty:</span> {angka(h.detail.total_qty)}
              </div>
              <div className="col-span-2">
                <span className="text-slate-400">Alasan:</span> {h.detail.alasan}
              </div>
              {h.detail.catatan && (
                <div className="col-span-2">
                  <span className="text-slate-400">Catatan:</span> {h.detail.catatan}
                </div>
              )}
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="py-2 pr-2">Barang</th>
                  <th className="py-2 pr-2 text-right">Qty</th>
                  {h.detail.type === "sales_return" && <th className="py-2 pr-2">Kondisi</th>}
                  <th className="py-2 text-right">Harga</th>
                </tr>
              </thead>
              <tbody>
                {h.detail.items?.map((it) => (
                  <tr key={it.id} className="border-b border-slate-100">
                    <td className="py-2 pr-2">
                      <p className="font-medium text-slate-800">{it.nama_barang}</p>
                      <p className="text-xs text-slate-400">{it.kode_barang}</p>
                    </td>
                    <td className="py-2 pr-2 text-right">{angka(it.qty)}</td>
                    {h.detail.type === "sales_return" && (
                      <td className="py-2 pr-2">
                        <Badge tone={it.kondisi === "bagus" ? "green" : "red"}>
                          {it.kondisi === "bagus" ? "Bagus" : "Rusak"}
                        </Badge>
                      </td>
                    )}
                    <td className="py-2 text-right">{rupiah(it.harga_satuan)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </>
  );
}
