"use client";
// Tab "Persetujuan Pending" (admin) — daftar retur pelanggan pending + modal
// detail + modal tolak. Data realtime (polling 5 detik).

import { Card, Button, Badge, Modal, Spinner, EmptyState } from "@/components/ui";
import { rupiah, angka, tanggalJam } from "@/lib/format";
import { STATUS_BADGES } from "../lib/badges";
import { usePendingApproval } from "../hooks/usePendingApproval";

export function PendingApprovalTab() {
  const a = usePendingApproval();

  return (
    <>
      <Card className="p-5">
        <div className="mb-4">
          <h3 className="font-semibold text-slate-800">
            Retur Pelanggan Menunggu Persetujuan
          </h3>
          <p className="text-xs text-slate-400">
            Retur dari kasir yang membutuhkan otorisasi admin sebelum stok diproses.
            Data diperbarui secara real-time.
          </p>
        </div>

        {a.isLoading && <Spinner label="Memuat..." />}

        {!a.isLoading && a.pendingItems.length === 0 && (
          <EmptyState
            title="Tidak ada retur pending"
            description="Semua retur pelanggan sudah diproses"
          />
        )}

        {!a.isLoading && a.pendingItems.length > 0 && (
          <div className="space-y-3">
            {a.pendingItems.map((row) => (
              <div
                key={row.id}
                className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-sm font-medium text-slate-800">
                      {row.kode_adjustment}
                    </p>
                    <Badge tone="amber">Pending</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Oleh: {row.username || "-"} · {tanggalJam(row.created_at)} · {angka(row.total_qty)} item
                  </p>
                  <p className="mt-0.5 max-w-md truncate text-xs text-slate-400">
                    {row.alasan}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  <button
                    onClick={() => a.openDetail(row.id)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Detail
                  </button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      a.setRejectId(row.id);
                      a.setRejectReason("");
                    }}
                    disabled={a.processing === row.id}
                  >
                    Tolak
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => a.handleApprove(row.id)}
                    disabled={a.processing === row.id}
                  >
                    {a.processing === row.id ? "..." : "Setujui"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Detail Modal */}
      <Modal
        open={!!a.detail || a.detailLoading}
        onClose={() => a.setDetail(null)}
        title={a.detail ? `Detail ${a.detail.kode_adjustment}` : "Memuat..."}
        width="max-w-2xl"
      >
        {a.detailLoading && <Spinner label="Memuat detail..." />}
        {a.detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-slate-400">Tipe:</span>{" "}
                <Badge tone="blue">Retur Pelanggan</Badge>
              </div>
              <div>
                <span className="text-slate-400">Status:</span>{" "}
                <Badge tone={STATUS_BADGES[a.detail.status]?.tone || "slate"}>
                  {STATUS_BADGES[a.detail.status]?.label || a.detail.status}
                </Badge>
              </div>
              <div>
                <span className="text-slate-400">Dibuat oleh:</span>{" "}
                {a.detail.username || "-"}
              </div>
              <div>
                <span className="text-slate-400">Tanggal:</span>{" "}
                {tanggalJam(a.detail.created_at)}
              </div>
              <div className="col-span-2">
                <span className="text-slate-400">Alasan:</span> {a.detail.alasan}
              </div>
              {a.detail.catatan && (
                <div className="col-span-2">
                  <span className="text-slate-400">Catatan:</span> {a.detail.catatan}
                </div>
              )}
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="py-2 pr-2">Barang</th>
                  <th className="py-2 pr-2 text-right">Qty</th>
                  <th className="py-2 pr-2">Kondisi</th>
                  <th className="py-2 text-right">Harga</th>
                </tr>
              </thead>
              <tbody>
                {a.detail.items?.map((it) => (
                  <tr key={it.id} className="border-b border-slate-100">
                    <td className="py-2 pr-2">
                      <p className="font-medium text-slate-800">{it.nama_barang}</p>
                      <p className="text-xs text-slate-400">{it.kode_barang}</p>
                    </td>
                    <td className="py-2 pr-2 text-right">{angka(it.qty)}</td>
                    <td className="py-2 pr-2">
                      <Badge tone={it.kondisi === "bagus" ? "green" : "red"}>
                        {it.kondisi === "bagus" ? "Bagus" : "Rusak"}
                      </Badge>
                    </td>
                    <td className="py-2 text-right">{rupiah(it.harga_satuan)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {a.detail.status === "pending" && (
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    a.setDetail(null);
                    a.setRejectId(a.detail.id);
                    a.setRejectReason("");
                  }}
                >
                  Tolak
                </Button>
                <Button
                  size="sm"
                  onClick={() => a.handleApprove(a.detail.id)}
                  disabled={a.processing === a.detail.id}
                >
                  {a.processing === a.detail.id ? "Memproses..." : "Setujui Retur"}
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Reject confirmation */}
      <Modal
        open={!!a.rejectId}
        onClose={() => a.setRejectId(null)}
        title="Tolak Retur Pelanggan"
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Retur ini akan ditolak dan stok tidak akan berubah. Berikan alasan
            penolakan:
          </p>
          <textarea
            value={a.rejectReason}
            onChange={(e) => a.setRejectReason(e.target.value)}
            placeholder="Alasan penolakan (opsional)..."
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => a.setRejectId(null)}>
              Batal
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={a.handleReject}
              disabled={a.processing === a.rejectId}
            >
              {a.processing === a.rejectId ? "Memproses..." : "Konfirmasi Tolak"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
