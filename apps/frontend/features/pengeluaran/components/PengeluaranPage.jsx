"use client";
// /pengeluaran — Input & riwayat pengeluaran operasional.

import {
  PageShell, PageHeader, Card, Badge,
  Button, Input, Select, Spinner, EmptyState,
  Table, THead, TH, TBody, TR, TD,
} from "@/components/ui";
import { rupiah, tanggal } from "@/lib/format";
import { Plus, Trash2, TrendingDown, DollarSign } from "lucide-react";
import { usePengeluaran } from "../hooks/usePengeluaran";
import { JENIS_OPTIONS, JENIS_LABELS, JENIS_BADGE_TONE } from "@/features/keuangan/lib/constants";

const DESKRIPSI_PLACEHOLDER = {
  gaji:    "mis. Gaji kasir Lina bulan Mei",
  listrik: "mis. Tagihan PLN bulan April",
  air:     "mis. Tagihan PDAM bulan April",
  custom:  "mis. Beli stempel toko / servis printer",
};

export default function PengeluaranPage() {
  const p = usePengeluaran();

  return (
    <PageShell>
      <PageHeader
        title="Pengeluaran Operasional"
        description="Catat biaya operasional: gaji karyawan, listrik, air, dan lainnya."
      />

      {/* Seluruh konten di-scroll dalam satu wrapper */}
      <div className="min-h-0 flex-1 overflow-auto thin-scroll">
        <div className="flex flex-col gap-4 pb-6">

          {/* ── Form Tambah ── */}
          <Card className="overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-brand-500 via-brand-600 to-indigo-500" />
            <div className="p-5">
              <div className="mb-4 flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <Plus size={16} />
                </span>
                <h2 className="font-semibold text-slate-800">Tambah Pengeluaran Operasional</h2>
              </div>

              <form onSubmit={p.handleSubmit}>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

                  {/* Jenis */}
                  <Select
                    label="Jenis Pengeluaran"
                    value={p.jenis}
                    onChange={(e) => p.setJenis(e.target.value)}
                  >
                    {JENIS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </Select>

                  {/* Tanggal */}
                  <Input
                    label="Tanggal"
                    type="date"
                    value={p.formTanggal}
                    onChange={(e) => p.setFormTanggal(e.target.value)}
                    required
                  />

                  {/* Nominal — step="1" agar semua angka bulat valid */}
                  <div>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-slate-700">Nominal (Rp)</span>
                      <div className="relative">
                        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                          <DollarSign size={14} />
                        </span>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          placeholder="0"
                          value={p.nominal}
                          onChange={(e) => p.setNominal(e.target.value)}
                          required
                          className="w-full rounded-lg border border-slate-200 bg-slate-50/50 py-2.5 pl-8 pr-3 text-sm text-slate-900 placeholder:text-slate-400 transition-all focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/10"
                        />
                      </div>
                    </label>
                  </div>

                  {/* Deskripsi */}
                  <Input
                    label="Deskripsi"
                    placeholder={DESKRIPSI_PLACEHOLDER[p.jenis] || "Deskripsi pengeluaran"}
                    value={p.deskripsi}
                    onChange={(e) => p.setDeskripsi(e.target.value)}
                    required
                  />
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  {/* Preview nominal */}
                  {p.nominal && Number(p.nominal) > 0 && (
                    <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-1.5">
                      <TrendingDown size={14} className="text-red-500" />
                      <span className="text-sm font-semibold text-red-700">
                        − {rupiah(Number(p.nominal))}
                      </span>
                      <span className="text-xs text-red-400">
                        · {JENIS_LABELS[p.jenis] || p.jenis}
                      </span>
                    </div>
                  )}
                  <Button type="submit" loading={p.creating} className="ml-auto">
                    <Plus size={16} /> Tambah Pengeluaran
                  </Button>
                </div>
              </form>
            </div>
          </Card>

          {/* ── Riwayat Pengeluaran ── */}
          <Card className="overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Riwayat Pengeluaran Operasional</h3>
                <p className="mt-0.5 text-xs text-slate-400">
                  {p.rows.length} entri
                  {p.totalVisible > 0 && (
                    <> · Total: <span className="font-semibold text-red-600">{rupiah(p.totalVisible)}</span></>
                  )}
                </p>
              </div>

              {/* Filter jenis saja */}
              <select
                value={p.jenisFilter}
                onChange={(e) => p.setJenisFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600 focus:border-brand-400 focus:outline-none"
              >
                <option value="all">Semua Jenis</option>
                {JENIS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Konten */}
            {p.list.isLoading ? (
              <div className="p-8"><Spinner label="Memuat riwayat..." /></div>
            ) : p.rows.length === 0 ? (
              <EmptyState
                title="Belum ada pengeluaran"
                description="Gunakan form di atas untuk mencatat pengeluaran operasional."
              />
            ) : (
              <>
                {/* Desktop table */}
                <div className="overflow-auto thin-scroll">
                  <Table className="min-w-[560px]">
                    <THead>
                      <TH>Tanggal</TH>
                      <TH>Jenis</TH>
                      <TH>Deskripsi</TH>
                      <TH>Dicatat Oleh</TH>
                      <TH className="text-right">Nominal</TH>
                      <TH className="text-right">Aksi</TH>
                    </THead>
                    <TBody>
                      {p.rows.map((r) => (
                        <TR key={r.id}>
                          <TD className="text-xs">{tanggal(r.tanggal)}</TD>
                          <TD>
                            <Badge tone={JENIS_BADGE_TONE[r.jenis] || "slate"}>
                              {JENIS_LABELS[r.jenis] || r.jenis}
                            </Badge>
                          </TD>
                          <TD className="max-w-[200px] truncate">{r.deskripsi}</TD>
                          <TD className="text-slate-500">{r.username || "-"}</TD>
                          <TD className="text-right font-semibold text-red-600">
                            − {rupiah(r.nominal)}
                          </TD>
                          <TD className="text-right">
                            <button
                              onClick={() => {
                                if (window.confirm(`Hapus "${r.deskripsi}"?`)) {
                                  p.del.mutate(r.id);
                                }
                              }}
                              className="inline-flex h-7 w-7 items-center justify-center rounded transition hover:bg-red-50"
                              title="Hapus"
                            >
                              <Trash2 size={14} className="text-slate-400 hover:text-red-500" />
                            </button>
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </div>

                {/* Mobile cards */}
                <ul className="divide-y divide-slate-100 md:hidden">
                  {p.rows.map((r) => (
                    <li key={r.id} className="flex items-start justify-between gap-2 p-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge tone={JENIS_BADGE_TONE[r.jenis] || "slate"}>
                            {JENIS_LABELS[r.jenis] || r.jenis}
                          </Badge>
                          <span className="text-xs text-slate-400">{tanggal(r.tanggal)}</span>
                        </div>
                        <p className="mt-1 text-sm text-slate-700">{r.deskripsi}</p>
                        <p className="text-xs text-slate-400">Oleh: {r.username || "-"}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <span className="font-semibold text-red-600">− {rupiah(r.nominal)}</span>
                        <button
                          onClick={() => {
                            if (window.confirm(`Hapus "${r.deskripsi}"?`)) {
                              p.del.mutate(r.id);
                            }
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded hover:bg-red-50"
                        >
                          <Trash2 size={13} className="text-slate-400" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
