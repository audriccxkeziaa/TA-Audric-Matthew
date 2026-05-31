"use client";
// /pengeluaran — Input & manajemen pengeluaran operasional.

import {
  PageShell, PageHeader, Card, Badge, Button,
  Input, Select, Textarea, Spinner, EmptyState,
  Table, THead, TH, TBody, TR, TD,
} from "@/components/ui";
import { rupiah, angka, tanggal } from "@/lib/format";
import {
  Plus, Trash2, TrendingDown, Receipt, Calendar, DollarSign, FileText,
} from "lucide-react";
import { usePengeluaran } from "../hooks/usePengeluaran";
import { JENIS_OPTIONS, JENIS_LABELS, JENIS_BADGE_TONE } from "@/features/keuangan/lib/constants";

const PERIOD_PRESETS = [
  { id: "bulan-ini",  label: "Bulan Ini" },
  { id: "bulan-lalu", label: "Bulan Lalu" },
  { id: "3-bulan",    label: "3 Bulan" },
  { id: "tahun-ini",  label: "Tahun Ini" },
  { id: "custom",     label: "Custom" },
];

// Warna ikon per jenis
const JENIS_ICON_COLOR = {
  gaji: "text-blue-600 bg-blue-50",
  listrik: "text-amber-600 bg-amber-50",
  air: "text-cyan-600 bg-cyan-50",
  custom: "text-slate-600 bg-slate-100",
};

export default function PengeluaranPage() {
  const p = usePengeluaran();

  return (
    <PageShell>
      <PageHeader
        title="Pengeluaran Operasional"
        description="Catat dan pantau biaya operasional: gaji karyawan, listrik, air, dan lainnya."
      />

      {/* ── Summary mini ── */}
      <div className="mb-4 grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Total Periode</p>
          <p className="mt-1.5 text-xl font-bold text-red-600">{rupiah(p.totalVisible)}</p>
          <p className="mt-0.5 text-xs text-slate-400">{p.rows.length} entri</p>
        </Card>
        {JENIS_OPTIONS.map((o) => {
          const subtotal = p.rows
            .filter((r) => r.jenis === o.value)
            .reduce((s, r) => s + Number(r.nominal || 0), 0);
          return (
            <Card key={o.value} className="p-4">
              <div className="flex items-center gap-2">
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${JENIS_ICON_COLOR[o.value] || "bg-slate-100 text-slate-600"}`}>
                  <TrendingDown size={14} />
                </span>
                <p className="text-xs font-medium text-slate-500">{o.label}</p>
              </div>
              <p className="mt-1.5 text-base font-bold text-slate-800">{rupiah(subtotal)}</p>
            </Card>
          );
        })}
      </div>

      {/* ── Form Tambah ── */}
      <Card className="mb-4 shrink-0 overflow-hidden">
        {/* Accent bar */}
        <div className="h-1 bg-gradient-to-r from-brand-500 via-brand-600 to-indigo-600" />
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
              <div className="relative">
                <Select
                  label="Jenis Pengeluaran"
                  value={p.jenis}
                  onChange={(e) => p.setJenis(e.target.value)}
                >
                  {JENIS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              </div>

              {/* Tanggal */}
              <Input
                label="Tanggal"
                type="date"
                value={p.formTanggal}
                onChange={(e) => p.setFormTanggal(e.target.value)}
                required
              />

              {/* Nominal */}
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
                      step="1000"
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
                placeholder={
                  p.jenis === "gaji" ? "mis. Gaji kasir Lina bulan Mei"
                  : p.jenis === "listrik" ? "mis. Tagihan PLN April"
                  : p.jenis === "air" ? "mis. Tagihan PDAM April"
                  : "mis. Beli stempel toko"
                }
                value={p.deskripsi}
                onChange={(e) => p.setDeskripsi(e.target.value)}
                required
              />
            </div>

            <div className="mt-4 flex items-center justify-between">
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
              <div className="ml-auto">
                <Button type="submit" loading={p.creating}>
                  <Plus size={16} /> Tambah Pengeluaran
                </Button>
              </div>
            </div>
          </form>
        </div>
      </Card>

      {/* ── Filter periode + jenis ── */}
      <Card className="mb-3 shrink-0 p-3">
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Periode:</span>
            {PERIOD_PRESETS.map((pr) => (
              <button
                key={pr.id}
                type="button"
                onClick={() => p.applyPreset(pr.id)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  p.periodPreset === pr.id
                    ? "bg-brand-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {pr.label}
              </button>
            ))}
            <span className="text-slate-200">|</span>
            <select
              value={p.jenisFilter}
              onChange={(e) => p.setJenisFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 focus:border-brand-400 focus:outline-none"
            >
              <option value="all">Semua Jenis</option>
              {JENIS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <Button size="sm" variant="secondary" onClick={p.resetFilter}>Reset</Button>
          </div>

          {p.periodPreset === "custom" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Dari Tanggal" type="date" value={p.from} onChange={(e) => p.setFrom(e.target.value)} />
              <Input label="Sampai Tanggal" type="date" value={p.to} onChange={(e) => p.setTo(e.target.value)} />
            </div>
          )}
        </div>
      </Card>

      {/* ── Tabel Pengeluaran ── */}
      <Card className="flex min-h-0 flex-1 flex-col p-0">
        {/* Header tabel */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-700">Daftar Pengeluaran Operasional</h3>
            <p className="mt-0.5 text-xs text-slate-400">
              {p.rows.length} entri · Total:{" "}
              <span className="font-semibold text-red-600">{rupiah(p.totalVisible)}</span>
            </p>
          </div>
          {p.jenisFilter !== "all" && (
            <Badge tone={JENIS_BADGE_TONE[p.jenisFilter] || "slate"}>
              {JENIS_LABELS[p.jenisFilter]}
            </Badge>
          )}
        </div>

        {p.list.isLoading ? (
          <div className="p-8"><Spinner label="Memuat pengeluaran..." /></div>
        ) : p.rows.length === 0 ? (
          <EmptyState
            title="Belum ada pengeluaran"
            description="Gunakan form di atas untuk menambahkan pengeluaran operasional."
            icon={<Receipt size={24} />}
          />
        ) : (
          <div className="min-h-0 flex-1 overflow-auto thin-scroll">
            {/* Desktop */}
            <Table className="min-w-[500px]">
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
                          if (confirm(`Hapus "${r.deskripsi}"?`)) p.del.mutate(r.id);
                        }}
                        className="inline-flex h-7 w-7 items-center justify-center rounded transition hover:bg-red-50 hover:text-red-600"
                        title="Hapus"
                      >
                        <Trash2 size={14} className="text-slate-400" />
                      </button>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>

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
                        if (confirm(`Hapus "${r.deskripsi}"?`)) p.del.mutate(r.id);
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded hover:bg-red-50"
                    >
                      <Trash2 size={13} className="text-slate-400" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </PageShell>
  );
}
