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
import { expensesApi } from "@/lib/api";
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
  { value: "supplier", label: "Beli Barang dari Supplier" },
  { value: "custom", label: "Custom" },
];

const JENIS_TONE = {
  gaji: "indigo",
  listrik: "amber",
  air: "blue",
  supplier: "green",
  custom: "slate",
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
function ExpenseForm({ open, onClose, editing }) {
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
      toast.success(isEdit ? "Pengeluaran diperbarui" : "Pengeluaran dicatat");
      onClose();
    },
    onError: (e) => setErr(e.message),
  });

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit Pengeluaran" : "Tambah Pengeluaran"}>
      <div className="space-y-3">
        <Select
          label="Jenis"
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
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>
            Batal
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
                : "Simpan"}
          </Button>
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
          description="Tambahkan lewat tombol 'Tambah Pengeluaran'."
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
      toast.success("Pengeluaran dihapus");
      setConfirmDel(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const s = summary.data?.data;
  const rows = list.data?.data || [];

  return (
    <PageShell>
      <PageHeader
        title="Keuangan"
        description="Saldo bersih = Omset Kotor − Pembelian Supplier − Pengeluaran Operasional. Pembelian otomatis dari nota OCR/manual tervalidasi."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setOpenForm(true);
            }}
          >
            + Tambah Pengeluaran
          </Button>
        }
      />

      {/* Filter rentang */}
      <Card className="mb-3 shrink-0 p-3">
        <div className="grid gap-3 sm:grid-cols-4">
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
            label="Jenis"
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
        <div className="mb-3 grid shrink-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Omset Kotor"
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
            label="Saldo Bersih"
            value={rupiah(s?.saldo_bersih || 0)}
            tone={s?.saldo_bersih >= 0 ? "good" : "bad"}
            hint={
              s?.saldo_bersih >= 0
                ? "untung — saldo positif"
                : "rugi — saldo negatif"
            }
          />
        </div>
      )}

      {/* Breakdown pengeluaran per jenis — clickable */}
      {s?.per_jenis && (
        <Card className="mb-3 shrink-0 p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            Breakdown Pengeluaran per Jenis · klik kotak untuk detail
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

      {/* Tabel pengeluaran */}
      <Card className="flex min-h-0 flex-1 flex-col p-0">
        {list.isLoading ? (
          <div className="p-6">
            <Spinner label="Memuat pengeluaran..." />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="Belum ada pengeluaran"
            description="Klik 'Tambah Pengeluaran' untuk mencatat gaji/listrik/dll."
          />
        ) : (
          <div className="min-h-0 flex-1 overflow-auto thin-scroll">
            <table className="w-full text-sm">
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
                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => {
                            setEditing(r);
                            setOpenForm(true);
                          }}
                          className="text-xs text-brand-600 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setConfirmDel(r)}
                          className="text-xs text-red-600 hover:underline"
                        >
                          Hapus
                        </button>
                      </div>
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
        title="Hapus Pengeluaran"
        message={`Hapus "${confirmDel?.deskripsi}" senilai ${rupiah(
          confirmDel?.nominal || 0
        )}? Saldo akan dihitung ulang.`}
        confirmLabel="Ya, hapus"
      />
    </PageShell>
  );
}
