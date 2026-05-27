"use client";
// =================================================================
// /keuangan — Manajemen Keuangan (admin only)
// =================================================================
// - Ringkasan: omset kotor, total pembelian (otomatis dari OCR/manual
//   purchase tervalidasi), total pengeluaran operasional, saldo bersih.
// - Tabel pengeluaran + form tambah & hapus.
// - Filter rentang tanggal (default: all-time).
// =================================================================

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { expensesApi, salesApi, purchasesApi } from "@/lib/api";
import { useToast } from "@/hooks/useToast";
import { rupiah, angka } from "@/lib/format";
import {
  PageShell,
  PageHeader,
  Card,
  StatCard,
  Badge,
  Button,
  Input,
  Select,
  Modal,
  ConfirmDialog,
  Spinner,
  EmptyState,
} from "@/components/ui";

const JENIS_OPTIONS = [
  { value: "gaji", label: "Gaji Karyawan" },
  { value: "listrik", label: "Listrik" },
  { value: "air", label: "Air (PDAM)" },
  { value: "custom", label: "Custom" },
];

const JENIS_TONE = {
  gaji: "indigo",
  listrik: "amber",
  air: "blue",
  custom: "green",
};

function tanggal(d) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Placeholder & label deskripsi tergantung jenis pengeluaran.
const DESKRIPSI_HINT = {
  gaji: { label: "Deskripsi", placeholder: "mis. Gaji kasir Lina bulan Mei" },
  listrik: { label: "Deskripsi", placeholder: "mis. Tagihan PLN April" },
  air: { label: "Deskripsi", placeholder: "mis. Tagihan PDAM April" },
  supplier: {
    label: "Nama Supplier",
    placeholder: "mis. PT Sumber Motor Jaya (kabel & aksesoris)",
  },
  custom: {
    label: "Label Pengeluaran (custom)",
    placeholder: "mis. Beli stempel toko / servis printer",
  },
};

// ---------- Form tambah / edit pengeluaran ----------
function ExpenseForm({ open, onClose, editing, onDelete }) {
  const qc = useQueryClient();
  const toast = useToast();
  const isEdit = Boolean(editing);
  const today = new Date().toISOString().slice(0, 10);

  const [jenis, setJenis] = useState(editing?.jenis || "gaji");
  const [deskripsi, setDeskripsi] = useState(editing?.deskripsi || "");
  const [nominal, setNominal] = useState(
    editing?.nominal != null ? String(editing.nominal) : ""
  );
  const [tgl, setTgl] = useState(editing?.tanggal || today);
  const [err, setErr] = useState("");

  const hint = DESKRIPSI_HINT[jenis] || DESKRIPSI_HINT.custom;

  const mut = useMutation({
    mutationFn: async () => {
      const n = Number(nominal);
      if (!deskripsi.trim()) throw new Error(`${hint.label} wajib diisi`);
      if (!Number.isFinite(n) || n <= 0)
        throw new Error("Nominal harus angka > 0");
      const payload = {
        jenis,
        deskripsi: deskripsi.trim(),
        nominal: n,
        tanggal: tgl,
      };
      if (isEdit) return expensesApi.update(editing.id, payload);
      return expensesApi.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["finance-summary"] });
      toast.success(isEdit ? "Pengeluaran Operasional diperbarui" : "Pengeluaran Operasional dicatat");
      onClose();
    },
    onError: (e) => setErr(e.message),
  });

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit Pengeluaran Operasional" : "Tambah Pengeluaran Operasional"}>
      <div className="space-y-3">
        <Select
          label="Jenis Pengeluaran"
          value={jenis}
          onChange={(e) => setJenis(e.target.value)}
        >
          {JENIS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Input
          label={hint.label}
          placeholder={hint.placeholder}
          value={deskripsi}
          onChange={(e) => setDeskripsi(e.target.value)}
        />
        {jenis === "supplier" && (
          <p className="text-xs text-slate-500">
            Catatan: ini untuk pembelian supplier yang <b>tidak via OCR</b>.
            Pembelian dengan nota OCR tervalidasi sudah otomatis terhitung di
            kartu "Pembelian Supplier".
          </p>
        )}
        {jenis === "custom" && (
          <p className="text-xs text-slate-500">
            Isi label bebas — akan dijumlahkan di kotak "Custom" pada
            breakdown.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Nominal (Rp)"
            type="number"
            min="0"
            value={nominal}
            onChange={(e) => setNominal(e.target.value)}
          />
          <Input
            label="Tanggal"
            type="date"
            value={tgl}
            onChange={(e) => setTgl(e.target.value)}
          />
        </div>
        {err && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {err}
          </div>
        )}
        <div className="flex justify-between gap-2 pt-1">
          <div>
            {isEdit && (
              <Button
                variant="ghost"
                onClick={() => {
                  onClose();
                  setTimeout(() => onDelete?.(editing), 100);
                }}
                className="text-red-600 hover:bg-red-50"
              >
                Hapus
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setErr("");
                mut.mutate();
              }}
              disabled={mut.isPending}
            >
              {mut.isPending
                ? "Menyimpan..."
                : isEdit
                  ? "Simpan Perubahan"
                  : "Save"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ---------- Modal detail pengeluaran per jenis ----------
function JenisDetailModal({ open, onClose, jenis, rows }) {
  const opt = JENIS_OPTIONS.find((o) => o.value === jenis);
  const filtered = rows.filter((r) => r.jenis === jenis);
  const total = filtered.reduce((a, r) => a + Number(r.nominal || 0), 0);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Detail — ${opt?.label || jenis}`}
      width="max-w-2xl"
    >
      <div className="mb-3 rounded-lg bg-slate-50 p-3 text-center">
        <p className="text-xs uppercase tracking-wide text-slate-500">
          Total {opt?.label || jenis}
        </p>
        <p className="mt-1 text-2xl font-extrabold text-slate-900">
          {rupiah(total)}
        </p>
        <p className="text-xs text-slate-400">
          {filtered.length} entri pada filter saat ini
        </p>
      </div>
      {filtered.length === 0 ? (
        <EmptyState
          title={`Belum ada pengeluaran ${opt?.label || jenis}`}
          description="Tambahkan lewat tombol 'Tambah Pengeluaran Operasional'."
        />
      ) : (
        <div className="max-h-80 overflow-auto thin-scroll rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Tanggal</th>
                <th className="px-3 py-2">
                  {jenis === "supplier" ? "Nama Supplier" : "Deskripsi"}
                </th>
                <th className="px-3 py-2">Dicatat oleh</th>
                <th className="px-3 py-2 text-right">Nominal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-xs">{tanggal(r.tanggal)}</td>
                  <td className="px-3 py-2">{r.deskripsi}</td>
                  <td className="px-3 py-2 text-slate-500">
                    {r.username || "-"}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-red-600">
                    − {rupiah(r.nominal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

export default function KeuanganPage() {
  const qc = useQueryClient();
  const toast = useToast();

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [jenisFilter, setJenisFilter] = useState("all");
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [jenisDetail, setJenisDetail] = useState(null);

  const params = useMemo(() => {
    const p = {};
    if (from) p.from = from;
    if (to) p.to = to + "T23:59:59.999Z";
    return p;
  }, [from, to]);

  const summary = useQuery({
    queryKey: ["finance-summary", from, to],
    queryFn: () => expensesApi.summary(params),
  });

  const list = useQuery({
    queryKey: ["expenses", from, to, jenisFilter],
    queryFn: () =>
      expensesApi.list({
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
        ...(jenisFilter !== "all" ? { jenis: jenisFilter } : {}),
        limit: 500,
      }),
  });

  const del = useMutation({
    mutationFn: (id) => expensesApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["finance-summary"] });
      toast.success("Pengeluaran Operasional berhasil dihapus");
      setConfirmDel(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const salesList = useQuery({
    queryKey: ["finance-sales", from, to],
    queryFn: () =>
      salesApi.list({
        ...(from ? { from } : {}),
        ...(to ? { to: to + "T23:59:59.999Z" } : {}),
        limit: 500,
      }),
  });

  const [showSales, setShowSales] = useState(false);
  const [salesPage, setSalesPage] = useState(1);
  const [detailTrx, setDetailTrx] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [showPurchases, setShowPurchases] = useState(false);
  const [purchasesPage, setPurchasesPage] = useState(1);
  const [detailPurchase, setDetailPurchase] = useState(null);
  const [detailPurchaseLoading, setDetailPurchaseLoading] = useState(false);

  const purchasesList = useQuery({
    queryKey: ["finance-purchases", from, to],
    queryFn: () =>
      purchasesApi.list({
        ...(from ? { from } : {}),
        ...(to ? { to: to + "T23:59:59.999Z" } : {}),
        limit: 500,
      }),
    enabled: showPurchases,
  });
  const purchasesRows = purchasesList.data?.data || [];

  async function openTrxDetail(id) {
    setDetailLoading(true);
    try {
      const res = await salesApi.get(id);
      setDetailTrx(res.data);
    } catch {
      setDetailTrx(null);
    } finally {
      setDetailLoading(false);
    }
  }

  async function openPurchaseDetail(id) {
    setDetailPurchaseLoading(true);
    try {
      const res = await purchasesApi.get(id);
      setDetailPurchase(res.data);
    } catch {
      setDetailPurchase(null);
    } finally {
      setDetailPurchaseLoading(false);
    }
  }

  const s = summary.data?.data;
  const rows = list.data?.data || [];
  const salesRows = salesList.data?.data || [];

  return (
    <PageShell>
      <PageHeader
        title="Keuangan"
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setOpenForm(true);
            }}
          >
            + Add Operational Cost
          </Button>
        }
      />

      {/* Filter rentang */}
      <Card className="mb-3 shrink-0 p-3">
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <Input
            label="Dari Tanggal"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <Input
            label="Sampai Tanggal"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
          <Select
            label="Jenis Pengeluaran"
            value={jenisFilter}
            onChange={(e) => setJenisFilter(e.target.value)}
          >
            <option value="all">Semua Jenis</option>
            {JENIS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <div className="flex items-end">
            <Button
              variant="secondary"
              onClick={() => {
                setFrom("");
                setTo("");
                setJenisFilter("all");
              }}
              className="w-full"
            >
              Reset Filter
            </Button>
          </div>
        </div>
      </Card>

      {/* Ringkasan saldo */}
      {summary.isLoading ? (
        <Card className="shrink-0 p-6">
          <Spinner label="Menghitung saldo..." />
        </Card>
      ) : (
        <div className="mb-3 grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Pendapatan Kotor"
            value={rupiah(s?.omset_kotor || 0)}
            tone="good"
            hint={`${angka(s?.n_sales || 0)} transaksi`}
          />
          <StatCard
            label="Pembelian Supplier"
            value={rupiah(s?.total_pembelian || 0)}
            tone="warn"
            hint={`${angka(s?.n_purchases || 0)} nota tervalidasi`}
          />
          <StatCard
            label="Pengeluaran Operasional"
            value={rupiah(s?.total_pengeluaran || 0)}
            tone="warn"
            hint={`${angka(s?.n_expenses || 0)} entri`}
          />
          <StatCard
            label="Pendapatan Bersih"
            value={rupiah(s?.saldo_bersih || 0)}
            tone={s?.saldo_bersih >= 0 ? "good" : "bad"}
          />
        </div>
      )}

      {/* Breakdown pengeluaran per jenis — clickable */}
      {s?.per_jenis && (
        <Card className="mb-3 shrink-0 p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            Breakdown Pengeluaran Operasional · klik kotak untuk detail
          </p>
          <div className="flex flex-wrap gap-2">
            {JENIS_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setJenisDetail(o.value)}
                className="group flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm transition hover:-translate-y-0.5 hover:border-brand-400 hover:bg-brand-50 hover:shadow-sm"
              >
                <Badge tone={JENIS_TONE[o.value]}>{o.label}</Badge>
                <span className="font-semibold">
                  {rupiah(s.per_jenis[o.value] || 0)}
                </span>
                <span className="ml-1 text-[10px] text-slate-400 group-hover:text-brand-600">
                  ↗
                </span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Pemasukan dari Penjualan */}
      <Card className="mb-3 shrink-0 p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Pendapatan Kotor
          </p>
                    <button
            type="button"
            onClick={() => setShowSales(true)}
            className="inline-flex items-center gap-1 rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition"
            title="Lihat detail pemasukan"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
        <p className="mt-1 text-lg font-bold text-emerald-700">
          + {rupiah(s?.omset_kotor || salesRows.reduce((a, r) => a + Number(r.total_harga || 0), 0))}
        </p>

        {/* --- POP UP MODAL PEMASUKAN --- */}
        <Modal 
          open={showSales} 
          onClose={() => { setShowSales(false); setSalesPage(1); }} 
          title="Detail Pendapatan Kotor dari Penjualan"
          width="max-w-4xl"
        >
          {salesList.isLoading ? (
            <Spinner label="Memuat..." />
          ) : salesRows.length === 0 ? (
            <p className="text-sm text-slate-400">Belum ada transaksi penjualan pada periode ini.</p>
          ) : (() => {
            // Logika pemecah halaman (Pagination)
            const PAGE_SIZE = 10;
            const totalPages = Math.max(1, Math.ceil(salesRows.length / PAGE_SIZE));
            const paginatedSales = salesRows.slice((salesPage - 1) * PAGE_SIZE, salesPage * PAGE_SIZE);

            return (
              <>
                <div className="max-h-96 overflow-auto thin-scroll rounded-lg border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Tanggal</th>
                        <th className="px-3 py-2">Kode Transaksi</th>
                        <th className="px-3 py-2">Kasir</th>
                        <th className="px-3 py-2 text-right">Nominal</th>
                        <th className="px-3 py-2 text-center">Detail</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedSales.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2 text-xs">{tanggal(r.created_at)}</td>
                          <td className="px-3 py-2 font-mono text-xs">{r.kode_transaksi}</td>
                          <td className="px-3 py-2 text-xs text-slate-500">{r.kasir || r.users?.username || "-"}</td>
                          <td className="px-3 py-2 text-right font-semibold text-emerald-600">
                            + {rupiah(r.total_harga)}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                setShowSales(false);
                                openTrxDetail(r.id);
                              }}
                              className="inline-flex items-center justify-center rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Tombol Navigasi Pagination */}
                {salesRows.length > PAGE_SIZE && (
                  <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
                    <span>page {salesPage} of {totalPages} ({salesRows.length} transactions)</span>
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" disabled={salesPage <= 1} onClick={() => setSalesPage(p => p - 1)}>
                        ← Previous
                      </Button>
                      <Button size="sm" variant="secondary" disabled={salesPage >= totalPages} onClick={() => setSalesPage(p => p + 1)}>
                        Next →
                      </Button>
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </Modal>
      </Card>

      {/* Pembelian Supplier — expandable */}
      <Card className="mb-3 shrink-0 p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Pembelian Supplier
          </p>
            <button
            type="button"
            onClick={() => setShowPurchases(true)}
            className="inline-flex items-center gap-1 rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition"
            title="Lihat detail nota supplier"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
        <p className="mt-1 text-lg font-bold text-amber-700">
          − {rupiah(s?.total_pembelian || 0)}
        </p>

        {/* --- POP UP MODAL PEMBELIAN --- */}
        <Modal 
          open={showPurchases} 
          onClose={() => { setShowPurchases(false); setPurchasesPage(1); }} 
          title="Detail Pembelian Supplier"
          width="max-w-4xl"
        >
          {purchasesList.isLoading ? (
            <Spinner label="Memuat..." />
          ) : purchasesRows.length === 0 ? (
            <p className="text-sm text-slate-400">Belum ada pembelian supplier pada periode ini.</p>
          ) : (() => {
            // Logika pemecah halaman (Pagination)
            const PAGE_SIZE = 5;
            const totalPages = Math.max(1, Math.ceil(purchasesRows.length / PAGE_SIZE));
            const paginatedPurch = purchasesRows.slice((purchasesPage - 1) * PAGE_SIZE, purchasesPage * PAGE_SIZE);

            return (
              <>
                <div className="max-h-96 overflow-auto thin-scroll rounded-lg border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Tanggal</th>
                        <th className="px-3 py-2">No. Nota</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2 text-right">Total</th>
                        <th className="px-3 py-2 text-center">Detail</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedPurch.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2 text-xs">{tanggal(r.created_at)}</td>
                          <td className="px-3 py-2 font-mono text-xs">{r.no_nota_supplier || "-"}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              r.status_validasi === "tervalidasi"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-slate-100 text-slate-600"
                            }`}>
                              {r.status_validasi === "tervalidasi" ? "Tervalidasi" : "Draft"}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-amber-700">
                            − {rupiah(r.total || 0)}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                setShowPurchases(false);
                                openPurchaseDetail(r.id);
                              }}
                              className="inline-flex items-center justify-center rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Tombol Navigasi Pagination */}
                {purchasesRows.length > PAGE_SIZE && (
                  <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
                    <span>page {purchasesPage} of {totalPages} ({purchasesRows.length} supplier invoices)</span>
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" disabled={purchasesPage <= 1} onClick={() => setPurchasesPage(p => p - 1)}>
                        ← Previous
                      </Button>
                      <Button size="sm" variant="secondary" disabled={purchasesPage >= totalPages} onClick={() => setPurchasesPage(p => p + 1)}>
                        Next →
                      </Button>
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </Modal>
      </Card>

      {/* Tabel pengeluaran */}
      <Card className="flex flex-col p-0 md:min-h-0 md:flex-1">
        {list.isLoading ? (
          <div className="p-6">
            <Spinner label="Memuat pengeluaran..." />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="Belum ada pengeluaran operasional"
            description="Klik 'Tambah Pengeluaran Operasional' untuk mencatat gaji/listrik/dll."
          />
        ) : (
          <div className="overflow-auto thin-scroll md:min-h-0 md:flex-1">
            <table className="w-full min-w-[500px] text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Tanggal</th>
                  <th className="px-4 py-2.5">Jenis</th>
                  <th className="px-4 py-2.5">Deskripsi</th>
                  <th className="px-4 py-2.5">Dicatat oleh</th>
                  <th className="px-4 py-2.5 text-right">Nominal</th>
                  <th className="px-4 py-2.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 text-xs">{tanggal(r.tanggal)}</td>
                    <td className="px-4 py-2.5">
                      <Badge tone={JENIS_TONE[r.jenis] || "slate"}>
                        {JENIS_OPTIONS.find((o) => o.value === r.jenis)?.label ||
                          r.jenis}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5">{r.deskripsi}</td>
                    <td className="px-4 py-2.5 text-slate-500">
                      {r.username || "-"}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-red-600">
                      − {rupiah(r.nominal)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => {
                          setEditing(r);
                          setOpenForm(true);
                        }}
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

      {openForm && (
        <ExpenseForm
          key={editing?.id || "new"}
          open={openForm}
          editing={editing}
          onDelete={(r) => setConfirmDel(r)}
          onClose={() => {
            setOpenForm(false);
            setEditing(null);
          }}
        />
      )}

      <JenisDetailModal
        open={Boolean(jenisDetail)}
        onClose={() => setJenisDetail(null)}
        jenis={jenisDetail}
        rows={rows}
      />

      <ConfirmDialog
        open={Boolean(confirmDel)}
        onClose={() => setConfirmDel(null)}
        onConfirm={() => del.mutate(confirmDel.id)}
        title="Hapus Pengeluaran Operasional"
        message={`Apakah anda yakin akan menghapus "${confirmDel?.deskripsi}" senilai ${rupiah(
          confirmDel?.nominal || 0
        )}?`}
        confirmLabel="Ya, hapus"
      />
      {/* Modal detail nota pembelian supplier */}
      <Modal
        open={Boolean(detailPurchase) || detailPurchaseLoading}
        onClose={() => setDetailPurchase(null)}
        title="Detail Nota Pembelian Supplier"
        width="max-w-2xl"
      >
        {detailPurchaseLoading ? (
          <Spinner label="Memuat detail nota..." />
        ) : detailPurchase ? (
          <div>
            <dl className="mb-4 grid grid-cols-2 gap-x-6 gap-y-1 rounded-lg bg-slate-50 px-4 py-3 text-sm">
              <div>
                <span className="text-xs text-slate-400">No. Nota</span>
                <p className="font-mono font-medium">{detailPurchase.no_nota_supplier || "-"}</p>
              </div>
              <div>
                <span className="text-xs text-slate-400">Tanggal</span>
                <p className="font-medium">{detailPurchase.created_at ? new Date(detailPurchase.created_at).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-"}</p>
              </div>
              <div>
                <span className="text-xs text-slate-400">Status</span>
                <p className="font-medium capitalize">{detailPurchase.status_validasi}</p>
              </div>
              <div>
                <span className="text-xs text-slate-400">Total</span>
                <p className="font-bold text-amber-700">{rupiah(detailPurchase.total)}</p>
              </div>
            </dl>
            {detailPurchase.items && detailPurchase.items.length > 0 && (
              <div className="max-h-72 overflow-auto thin-scroll rounded-lg border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">Barang</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-right">Harga Beli</th>
                      <th className="px-3 py-2 text-right">Diskon</th>
                      <th className="px-3 py-2 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {detailPurchase.items.map((it, i) => {
                      const sub = it.qty * it.harga_beli * (1 - (it.diskon_persen || 0) / 100);
                      return (
                        <tr key={it.id || i} className="hover:bg-slate-50">
                          <td className="px-3 py-2 text-xs text-slate-400">{i + 1}</td>
                          <td className="px-3 py-2">
                            <span className="text-xs font-medium">{it.nama_barang || "-"}</span>
                            {it.kode_barang && (
                              <span className="block font-mono text-[10px] text-slate-400">{it.kode_barang}</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">{it.qty}</td>
                          <td className="px-3 py-2 text-right">{rupiah(it.harga_beli)}</td>
                          <td className="px-3 py-2 text-right text-amber-600">
                            {Number(it.diskon_persen) > 0 ? `${it.diskon_persen}%` : "-"}
                          </td>
                          <td className="px-3 py-2 text-right font-medium">{rupiah(sub)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {(Number(detailPurchase.diskon_persen) > 0 || Number(detailPurchase.potongan_harga) > 0) && (
              <div className="mt-3 rounded-lg bg-amber-50 px-4 py-2 text-sm">
                {Number(detailPurchase.diskon_persen) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Diskon Nota ({detailPurchase.diskon_persen}%)</span>
                    <span className="font-medium text-rose-600">
                      −{rupiah(Math.round(detailPurchase.total * detailPurchase.diskon_persen / 100))}
                    </span>
                  </div>
                )}
                {Number(detailPurchase.potongan_harga) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Potongan Harga</span>
                    <span className="font-medium text-rose-600">−{rupiah(detailPurchase.potongan_harga)}</span>
                  </div>
                )}
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <Button variant="secondary" onClick={() => setDetailPurchase(null)}>Tutup</Button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Modal detail transaksi penjualan */}
      <Modal
        open={Boolean(detailTrx) || detailLoading}
        onClose={() => setDetailTrx(null)}
        title="Detail Transaksi Penjualan"
      >
        {detailLoading ? (
          <Spinner label="Memuat detail..." />
        ) : detailTrx ? (
          <div>
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Kode Transaksi</dt>
                <dd className="font-mono font-medium">{detailTrx.kode_transaksi}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Tanggal & Jam</dt>
                <dd>{detailTrx.created_at ? new Date(detailTrx.created_at).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Kasir</dt>
                <dd className="font-medium">{detailTrx.kasir || "-"}</dd>
              </div>
              {(Number(detailTrx.diskon_persen) > 0 || Number(detailTrx.potongan_harga) > 0) && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Diskon</dt>
                  <dd className="text-amber-700">
                    {Number(detailTrx.diskon_persen) > 0 && `${detailTrx.diskon_persen}%`}
                    {Number(detailTrx.diskon_persen) > 0 && Number(detailTrx.potongan_harga) > 0 && " + "}
                    {Number(detailTrx.potongan_harga) > 0 && rupiah(detailTrx.potongan_harga)}
                  </dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-slate-500">Total</dt>
                <dd className="font-bold text-emerald-700">{rupiah(detailTrx.total_harga)}</dd>
              </div>
            </dl>
            {detailTrx.items && detailTrx.items.length > 0 && (
              <div className="mt-3 max-h-60 overflow-auto thin-scroll rounded-lg border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Barang</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-right">Harga</th>
                      <th className="px-3 py-2 text-right">Diskon</th>
                      <th className="px-3 py-2 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {detailTrx.items.map((it, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-3 py-2">
                          <span className="text-xs">{it.nama_barang || "-"}</span>
                          {it.kode_barang && (
                            <span className="ml-1 text-[10px] text-slate-400">({it.kode_barang})</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">{it.qty}</td>
                        <td className="px-3 py-2 text-right">{rupiah(it.harga_satuan)}</td>
                        <td className="px-3 py-2 text-right text-amber-600">{Number(it.diskon_persen) > 0 ? `${it.diskon_persen}%` : "-"}</td>
                        <td className="px-3 py-2 text-right font-medium">{rupiah(it.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </PageShell>
  );
}
