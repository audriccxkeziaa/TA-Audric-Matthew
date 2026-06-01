"use client";
import { Card, Button, Badge, Modal, Spinner, EmptyState } from "@/components/ui";
import { rupiah, angka, tanggalJam } from "@/lib/format";
import { XCircle, CheckCircle, Undo2 } from "lucide-react";
import { TYPE_BADGES, getStatusBadge } from "../lib/badges";
import { printReturnReceipt } from "@/lib/receipt";
import { useHistory } from "../hooks/useHistory";

function fmtWita(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("id-ID", {
    timeZone: "Asia/Makassar",
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function DashLine() {
  return <div className="my-2 border-t border-dashed border-slate-300" />;
}

function ReturnReceiptPreview({ detail }) {
  const tb = TYPE_BADGES[detail.type] || { label: detail.type, tone: "slate" };
  const totalNilai = (detail.items || []).reduce(
    (s, it) => s + Number(it.qty) * Number(it.harga_satuan),
    0
  );
  return (
    <div className="rounded border border-slate-200 bg-white p-3 font-mono text-[10px] leading-snug text-slate-900 shadow-inner">
      {/* Header toko */}
      <div className="mb-2 text-center">
        <div className="text-[12px] font-bold">CV ASIA JAYA MAJU</div>
        <div className="text-[9px] text-slate-500">Suku Cadang Sepeda Motor</div>
        <div className="text-[7.5px] text-slate-400">Jl. A. Yani KM 34 No. 56, Loktabat Selatan</div>
        <div className="text-[7.5px] text-slate-400">Banjarbaru, Kalsel 70714</div>
        <div className="text-[7.5px] text-slate-400">No. Telp: 0851-0262-6289</div>
      </div>

      <div className="mb-2 text-center text-[10px] font-bold tracking-wide">
        — {tb.label.toUpperCase()} —
      </div>

      <DashLine />

      {/* Meta */}
      <div className="space-y-0.5 text-[9.5px]">
        <div className="flex gap-1">
          <span className="w-14 shrink-0 text-slate-400">Kode</span>
          <span className="break-all">: {detail.kode_adjustment}</span>
        </div>
        <div className="flex gap-1">
          <span className="w-14 shrink-0 text-slate-400">Tanggal</span>
          <span>: {fmtWita(detail.created_at)}</span>
        </div>
        {detail.supplier_name && (
          <div className="flex gap-1">
            <span className="w-14 shrink-0 text-slate-400">Supplier</span>
            <span className="break-words">: {detail.supplier_name}</span>
          </div>
        )}
        {detail.username && (
          <div className="flex gap-1">
            <span className="w-14 shrink-0 text-slate-400">User</span>
            <span>: {detail.username}</span>
          </div>
        )}
        {detail.alasan && (
          <div className="flex gap-1">
            <span className="w-14 shrink-0 text-slate-400">Alasan</span>
            <span className="break-words">: {detail.alasan}</span>
          </div>
        )}
      </div>

      <DashLine />

      {/* Item-item */}
      <div className="space-y-2">
        {(detail.items || []).map((it, idx) => (
          <div key={idx}>
            <div className="truncate text-[10px] font-semibold">{it.nama_barang}</div>
            <div className="flex justify-between text-[9px] text-slate-500">
              <span>{it.qty} × {rupiah(it.harga_satuan)}</span>
              <span className="font-medium text-slate-800">
                {rupiah(Number(it.qty) * Number(it.harga_satuan))}
              </span>
            </div>
          </div>
        ))}
      </div>

      <DashLine />

      <div className="flex justify-between text-[11px] font-bold">
        <span>TOTAL NILAI</span>
        <span>{rupiah(totalNilai)}</span>
      </div>

      <DashLine />

      <div className="mt-1 text-center text-[8.5px] text-slate-400">
        Dokumen resmi retur — CV Asia Jaya Maju
      </div>
    </div>
  );
}

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
              {/* ===== Tampilan DESKTOP (md+) ===== */}
              <table className="hidden w-full text-sm md:table">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-2">Kode</th>
                    <th className="py-2 pr-2">Tipe</th>
                    <th className="py-2 pr-2">Status</th>
                    <th className="py-2 pr-2">User</th>
                    <th className="py-2 pr-2">Alasan</th>
                    <th className="py-2 px-4 text-right">Total Qty</th>
                    <th className="py-2 pr-2">Tanggal</th>
                    <th className="py-2 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {h.pagedData.map((row) => {
                    const tb = TYPE_BADGES[row.type] || { label: row.type, tone: "slate" };
                    const sb = getStatusBadge(row.type, row.status);
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
                        <td className="py-2 px-4 text-right">{angka(row.total_qty)}</td>
                        <td className="py-2 pr-2 text-xs text-slate-500">{tanggalJam(row.created_at)}</td>
                        <td className="py-2">
                          <div className="flex items-center justify-center gap-0.5">
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
                            {row.status === "pending" && (
                              <>
                                <button
                                  onClick={() => h.cancelEntry(row.id)}
                                  disabled={h.processing === row.id}
                                  className="inline-flex h-6 w-6 items-center justify-center rounded text-red-500 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
                                  title="Tolak"
                                >
                                  <XCircle className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => h.approveEntry(row.id)}
                                  disabled={h.processing === row.id}
                                  className="inline-flex h-6 w-6 items-center justify-center rounded text-emerald-600 transition hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-40"
                                  title="Setujui"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </button>
                              </>
                            )}
                            {(row.status === "approved" || row.status === "selesai") && (
                              <button
                                onClick={() => h.voidEntry(row.id)}
                                disabled={h.processing === row.id}
                                className="inline-flex h-6 w-6 items-center justify-center rounded text-orange-500 transition hover:bg-orange-50 hover:text-orange-700 disabled:opacity-40"
                                title="Batalkan (Void)"
                              >
                                <Undo2 className="h-4 w-4" />
                              </button>
                            )}
                            {row.status === "cancelled" && (
                              <button
                                disabled
                                className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-300 cursor-not-allowed"
                                title="Sudah dibatalkan"
                              >
                                <Undo2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* ===== Tampilan HP (< md) — kartu per riwayat ===== */}
              <ul className="divide-y divide-slate-100 md:hidden">
                {h.pagedData.map((row) => {
                  const tb = TYPE_BADGES[row.type] || { label: row.type, tone: "slate" };
                  const sb = getStatusBadge(row.type, row.status);
                  return (
                    <li key={row.id} className="py-3 transition-colors hover:bg-brand-50/40">
                      <div className="flex items-start justify-between gap-2">
                        <button
                          onClick={() => h.openDetail(row.id)}
                          className="min-w-0 text-left"
                        >
                          <p className="font-mono text-xs font-medium text-slate-700">
                            {row.kode_adjustment}
                          </p>
                        </button>
                        <div className="flex shrink-0 items-center gap-1">
                          <span className="text-xs text-slate-500">Qty {angka(row.total_qty)}</span>
                          {row.status === "pending" && (
                            <>
                              <button
                                onClick={() => h.cancelEntry(row.id)}
                                disabled={h.processing === row.id}
                                className="flex h-7 w-7 items-center justify-center rounded text-red-500 transition hover:bg-red-50 disabled:opacity-40"
                                title="Tolak"
                              >
                                <XCircle className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => h.approveEntry(row.id)}
                                disabled={h.processing === row.id}
                                className="flex h-7 w-7 items-center justify-center rounded text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-40"
                                title="Setujui"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          {(row.status === "approved" || row.status === "selesai") && (
                            <button
                              onClick={() => h.voidEntry(row.id)}
                              disabled={h.processing === row.id}
                              className="flex h-7 w-7 items-center justify-center rounded text-orange-500 transition hover:bg-orange-50 disabled:opacity-40"
                              title="Batalkan (Void)"
                            >
                              <Undo2 className="h-4 w-4" />
                            </button>
                          )}
                          {row.status === "cancelled" && (
                            <button
                              disabled
                              className="flex h-7 w-7 items-center justify-center rounded text-slate-300 cursor-not-allowed"
                              title="Sudah dibatalkan"
                            >
                              <Undo2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => h.openDetail(row.id)}
                        className="mt-1.5 block w-full text-left"
                      >
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge tone={tb.tone}>{tb.label}</Badge>
                          <Badge tone={sb.tone}>{sb.label}</Badge>
                        </div>
                        <p className="mt-1.5 line-clamp-2 text-xs text-slate-600" title={row.alasan}>
                          {row.alasan}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {row.username || "-"} · {tanggalJam(row.created_at)}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
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

      {/* Detail Modal — Dual-Panel untuk return_supplier, single-panel untuk lainnya */}
      <Modal
        open={!!h.detail || h.detailLoading}
        onClose={() => h.setDetail(null)}
        title={h.detail ? `Detail ${h.detail.kode_adjustment}` : "Memuat..."}
        width={h.detail?.type === "return_supplier" ? "max-w-5xl" : "max-w-2xl"}
      >
        {h.detailLoading && <Spinner label="Memuat detail..." />}
        {h.detail && (() => {
          const isRTS = h.detail.type === "return_supplier";

          const InfoGrid = () => (
            <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 px-4 py-3 text-sm">
              <div>
                <span className="text-xs text-slate-400">Tipe</span>
                <div className="mt-0.5">
                  <Badge tone={TYPE_BADGES[h.detail.type]?.tone || "slate"}>
                    {TYPE_BADGES[h.detail.type]?.label || h.detail.type}
                  </Badge>
                </div>
              </div>
              <div>
                <span className="text-xs text-slate-400">Status</span>
                <div className="mt-0.5">
                  <Badge tone={getStatusBadge(h.detail.type, h.detail.status).tone}>
                    {getStatusBadge(h.detail.type, h.detail.status).label}
                  </Badge>
                </div>
              </div>
              <div>
                <span className="text-xs text-slate-400">Dibuat Oleh</span>
                <p className="font-medium">{h.detail.username || "-"}</p>
              </div>
              {h.detail.approved_at && (
                <div>
                  <span className="text-xs text-slate-400">Tanggal Keputusan</span>
                  <p className="font-medium">{fmtWita(h.detail.approved_at)}</p>
                </div>
              )}
              <div>
                <span className="text-xs text-slate-400">Total Qty</span>
                <p className="font-medium">{angka(h.detail.total_qty)}</p>
              </div>
              <div className={h.detail.catatan ? "" : "col-span-2"}>
                <span className="text-xs text-slate-400">Alasan</span>
                <p className="font-medium">{h.detail.alasan}</p>
              </div>
              {h.detail.catatan && (
                <div>
                  <span className="text-xs text-slate-400">Catatan</span>
                  <p className="font-medium">{h.detail.catatan}</p>
                </div>
              )}
            </div>
          );

          const ItemsTable = () => (
            <div className="max-h-60 overflow-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Barang</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    {h.detail.type === "sales_return" && <th className="px-3 py-2">Kondisi</th>}
                    <th className="px-3 py-2 text-right">Harga</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {h.detail.items?.map((it) => (
                    <tr key={it.id} className="hover:bg-slate-50/50">
                      <td className="px-3 py-2">
                        <p className="font-medium text-slate-800">{it.nama_barang}</p>
                        <p className="font-mono text-xs text-slate-400">{it.kode_barang}</p>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{angka(it.qty)}</td>
                      {h.detail.type === "sales_return" && (
                        <td className="px-3 py-2">
                          <Badge tone={it.kondisi === "bagus" ? "green" : "red"}>
                            {it.kondisi === "bagus" ? "Bagus" : "Rusak"}
                          </Badge>
                        </td>
                      )}
                      <td className="px-3 py-2 text-right tabular-nums">{rupiah(it.harga_satuan)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );

          if (isRTS) {
            return (
              <div className="flex gap-6">
                <div className="flex w-1/2 min-w-0 flex-col gap-4">
                  <InfoGrid />
                  <ItemsTable />
                  <div className="flex justify-end">
                    <Button variant="secondary" onClick={() => h.setDetail(null)}>Close</Button>
                  </div>
                </div>
                <div className="flex w-1/2 flex-col gap-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Preview Struk</p>
                  <div className="max-h-[420px] flex-1 overflow-y-auto">
                    <ReturnReceiptPreview detail={h.detail} />
                  </div>
                  <Button className="w-full" onClick={() => printReturnReceipt(h.detail)}>
                    🖨️ Print Receipt
                  </Button>
                </div>
              </div>
            );
          }

          return (
            <div className="space-y-4">
              <InfoGrid />
              <ItemsTable />
              <div className="flex justify-end">
                <Button variant="secondary" onClick={() => h.setDetail(null)}>Close</Button>
              </div>
            </div>
          );
        })()}
      </Modal>
    </>
  );
}
