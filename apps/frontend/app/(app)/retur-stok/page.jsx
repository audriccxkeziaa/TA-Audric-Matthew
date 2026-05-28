"use client";

import { useState, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { adjustmentsApi } from "@/lib/api";
import { rupiah, angka, tanggalJam } from "@/lib/format";
import {
  PageShell,
  PageHeader,
  Card,
  Button,
  Input,
  Badge,
  Modal,
  ConfirmDialog,
  Spinner,
  EmptyState,
} from "@/components/ui";
import ProductPicker from "@/components/ProductPicker";

const TYPE_BADGES = {
  return_supplier: { label: "Retur Supplier", tone: "amber" },
  sales_return: { label: "Retur Pelanggan", tone: "blue" },
  stock_adjustment: { label: "Penyesuaian Stok", tone: "red" },
};

const STATUS_BADGES = {
  pending: { label: "Menunggu", tone: "amber" },
  approved: { label: "Disetujui", tone: "green" },
  rejected: { label: "Ditolak", tone: "red" },
};

// ======================== MAIN PAGE ========================

export default function ReturStokPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const TABS = [
    { id: "return_supplier", label: "Retur ke Supplier" },
    { id: "sales_return", label: "Retur Pelanggan" },
    ...(isAdmin
      ? [{ id: "stock_adjustment", label: "Penyesuaian Stok" }]
      : []),
    ...(isAdmin
      ? [{ id: "pending_approval", label: "Persetujuan Pending" }]
      : []),
    { id: "history", label: "Riwayat" },
  ];

  const [tab, setTab] = useState("return_supplier");

  return (
    <PageShell>
      <PageHeader
        title="Retur & Penyesuaian Stok"
        description="Kelola retur supplier, retur pelanggan, dan penyesuaian stok (penyusutan)"
      />

      {/* Tab bar */}
      <div className="mb-4 flex shrink-0 gap-1 rounded-lg bg-slate-100 p-1 overflow-x-auto">
        {TABS.map((t) => (
          <TabButton key={t.id} id={t.id} label={t.label} active={tab} onClick={setTab} />
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pb-4">
        {tab === "return_supplier" && <ReturSupplierForm />}
        {tab === "sales_return" && <ReturPelangganForm />}
        {tab === "stock_adjustment" && isAdmin && <PenyesuaianStokForm />}
        {tab === "pending_approval" && isAdmin && <PendingApprovalTab />}
        {tab === "history" && <HistoryTab />}
      </div>
    </PageShell>
  );
}

function TabButton({ id, label, active, onClick }) {
  const { data: pendingData } = useQuery({
    queryKey: ["notif-pending-approval"],
    queryFn: adjustmentsApi.pendingCount,
    refetchInterval: 30_000,
    enabled: id === "pending_approval",
  });
  const pendingCount = id === "pending_approval" ? pendingData?.count || 0 : 0;

  return (
    <button
      onClick={() => onClick(id)}
      className={`relative flex-shrink-0 rounded-md px-3 py-2 text-sm font-medium transition whitespace-nowrap ${
        active === id
          ? "bg-white text-slate-900 shadow-sm"
          : "text-slate-500 hover:text-slate-700"
      }`}
    >
      {label}
      {pendingCount > 0 && (
        <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">
          {pendingCount}
        </span>
      )}
    </button>
  );
}

// ======================== RETUR KE SUPPLIER ========================

function ReturSupplierForm() {
  const toast = useToast();
  const [notaQ, setNotaQ] = useState("");
  const [purchases, setPurchases] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [returnItems, setReturnItems] = useState([]);
  const [alasan, setAlasan] = useState("");
  const [catatan, setCatatan] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchPurchases = useCallback(async (q) => {
    setSearching(true);
    try {
      const res = await adjustmentsApi.lookupPurchase(q);
      setPurchases(res.data || []);
    } catch (err) {
      toast.error(err.message || "Gagal mencari");
    } finally {
      setSearching(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPurchases("");
  }, [fetchPurchases]);

  function selectPurchase(p) {
    setSelected(p);
    setReturnItems(
      p.items.map((it) => ({ ...it, return_qty: 0, checked: false }))
    );
  }

  function toggleItem(idx) {
    setReturnItems((prev) =>
      prev.map((it, i) =>
        i === idx
          ? { ...it, checked: !it.checked, return_qty: !it.checked ? 1 : 0 }
          : it
      )
    );
  }

  function setQty(idx, val) {
    setReturnItems((prev) =>
      prev.map((it, i) =>
        i === idx ? { ...it, return_qty: Math.max(0, Math.min(val, it.qty)) } : it
      )
    );
  }

  const checkedItems = returnItems.filter((it) => it.checked && it.return_qty > 0);

  async function handleSubmit() {
    setConfirm(false);
    setSubmitting(true);
    try {
      const res = await adjustmentsApi.create({
        type: "return_supplier",
        reference_purchase_id: selected.id,
        alasan,
        catatan: catatan || null,
        items: checkedItems.map((it) => ({
          product_id: it.product_id,
          qty: it.return_qty,
          harga_satuan: it.harga_beli,
        })),
      });
      toast.success(res.message || "Retur supplier berhasil");
      setSelected(null);
      setReturnItems([]);
      setAlasan("");
      setCatatan("");
      setNotaQ("");
      fetchPurchases("");
    } catch (err) {
      toast.error(err.message || "Gagal menyimpan retur");
    } finally {
      setSubmitting(false);
    }
  }

  if (!selected) {
    return (
      <Card className="p-5">
        <h3 className="mb-3 font-semibold text-slate-800">
          Pilih Nota Pembelian Supplier
        </h3>
        <input
          placeholder="Filter no. nota supplier..."
          value={notaQ}
          onChange={(e) => {
            setNotaQ(e.target.value);
            fetchPurchases(e.target.value);
          }}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
        />

        <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
          {searching && (
            <div className="py-4 text-center">
              <Spinner />
            </div>
          )}
          {!searching && purchases.length === 0 && (
            <p className="py-4 text-center text-sm text-slate-400">Tidak ada nota ditemukan</p>
          )}
          {!searching &&
            purchases.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => selectPurchase(p)}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-4 py-3 text-left hover:border-brand-400 hover:bg-brand-50"
              >
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {p.no_nota_supplier || "(tanpa nomor)"}
                  </p>
                  <p className="text-xs text-slate-400">
                    {tanggalJam(p.created_at)} · {p.items?.length || 0} item
                  </p>
                </div>
                <p className="text-sm font-semibold text-slate-700">
                  {rupiah(p.total)}
                </p>
              </button>
            ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-800">
            Retur Nota: {selected.no_nota_supplier || "(tanpa nomor)"}
          </h3>
          <p className="text-xs text-slate-400">{tanggalJam(selected.created_at)}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
          Change Invoice
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-2 pr-2">Pilih</th>
              <th className="py-2 pr-2">Barang</th>
              <th className="py-2 pr-2 text-right">Qty Beli</th>
              <th className="py-2 pr-2 text-right">Harga Beli</th>
              <th className="py-2 text-right">Qty Retur</th>
            </tr>
          </thead>
          <tbody>
            {returnItems.map((it, idx) => (
              <tr key={it.id} className="border-b border-slate-100">
                <td className="py-2 pr-2">
                  <input
                    type="checkbox"
                    checked={it.checked}
                    onChange={() => toggleItem(idx)}
                    className="rounded"
                  />
                </td>
                <td className="py-2 pr-2">
                  <p className="font-medium text-slate-800">{it.nama_barang}</p>
                  <p className="text-xs text-slate-400">{it.kode_barang}</p>
                </td>
                <td className="py-2 pr-2 text-right">{angka(it.qty)}</td>
                <td className="py-2 pr-2 text-right">{rupiah(it.harga_beli)}</td>
                <td className="py-2 text-right">
                  {it.checked ? (
                    <input
                      type="number"
                      min={1}
                      max={it.qty}
                      value={it.return_qty}
                      onChange={(e) => setQty(idx, parseInt(e.target.value) || 0)}
                      className="w-20 rounded border border-slate-300 px-2 py-1 text-right text-sm"
                    />
                  ) : (
                    <span className="text-slate-300">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Alasan Retur <span className="text-red-500">*</span>
          </label>
          <textarea
            value={alasan}
            onChange={(e) => setAlasan(e.target.value)}
            placeholder="Contoh: Barang tidak sesuai tipe, jumlah kurang dari nota..."
            rows={2}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <Input
          label="Catatan (opsional)"
          value={catatan}
          onChange={(e) => setCatatan(e.target.value)}
          placeholder="Catatan tambahan..."
        />
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {checkedItems.length} item dipilih · Total qty retur:{" "}
          <strong>
            {angka(checkedItems.reduce((s, it) => s + it.return_qty, 0))}
          </strong>
        </p>
        <Button
          onClick={() => setConfirm(true)}
          disabled={checkedItems.length === 0 || !alasan.trim() || submitting}
          variant="danger"
        >
          {submitting ? "Processing..." : "Process Return "}
        </Button>
      </div>

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={handleSubmit}
        title="Konfirmasi Retur Supplier"
        message={`Stok ${checkedItems.length} barang akan BERKURANG. Lanjutkan?`}
      />
    </Card>
  );
}

// ======================== RETUR PELANGGAN + MANAGER OVERRIDE ========================

function ReturPelangganForm() {
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [kodeQ, setKodeQ] = useState("");
  const [sales, setSales] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [returnItems, setReturnItems] = useState([]);
  const [alasan, setAlasan] = useState("");
  const [catatan, setCatatan] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Manager Override state
  const [overrideData, setOverrideData] = useState(null); // { adjustmentId, kode }
  const [pinUsername, setPinUsername] = useState("");
  const [pinPassword, setPinPassword] = useState("");
  const [pinSubmitting, setPinSubmitting] = useState(false);
  const [pinError, setPinError] = useState("");

  // Realtime: watch for approval status changes on the pending adjustment
  const { data: pendingDetail } = useQuery({
    queryKey: ["adjustments", overrideData?.adjustmentId],
    queryFn: () => adjustmentsApi.get(overrideData.adjustmentId),
    enabled: !!overrideData?.adjustmentId,
    refetchInterval: 3000,
  });

  // Auto-close override modal if approved remotely (Opsi B sync)
  useEffect(() => {
    if (
      pendingDetail?.data?.status === "approved" &&
      overrideData
    ) {
      toast.success("Retur pelanggan telah disetujui oleh admin!");
      setOverrideData(null);
      resetForm();
      qc.invalidateQueries({ queryKey: ["adjustments"] });
      qc.invalidateQueries({ queryKey: ["notif-pending-approval"] });
    } else if (
      pendingDetail?.data?.status === "rejected" &&
      overrideData
    ) {
      toast.error("Retur pelanggan ditolak oleh admin.");
      setOverrideData(null);
      resetForm();
      qc.invalidateQueries({ queryKey: ["adjustments"] });
      qc.invalidateQueries({ queryKey: ["notif-pending-approval"] });
    }
  }, [pendingDetail?.data?.status]);

  function resetForm() {
    setSelected(null);
    setReturnItems([]);
    setAlasan("");
    setCatatan("");
    setSales([]);
    setKodeQ("");
  }

  const fetchSales = useCallback(async (q) => {
    setSearching(true);
    try {
      const res = await adjustmentsApi.lookupSale(q);
      setSales(res.data || []);
    } catch (err) {
      toast.error(err.message || "Gagal mencari");
    } finally {
      setSearching(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchSales("");
  }, [fetchSales]);

  function selectSale(s) {
    setSelected(s);
    setReturnItems(
      s.items.map((it) => ({
        ...it,
        return_qty: 0,
        kondisi: "bagus",
        checked: false,
      }))
    );
  }

  function toggleItem(idx) {
    setReturnItems((prev) =>
      prev.map((it, i) =>
        i === idx
          ? { ...it, checked: !it.checked, return_qty: !it.checked ? 1 : 0 }
          : it
      )
    );
  }

  function setQty(idx, val) {
    setReturnItems((prev) =>
      prev.map((it, i) =>
        i === idx ? { ...it, return_qty: Math.max(0, Math.min(val, it.qty)) } : it
      )
    );
  }

  function setKondisi(idx, kondisi) {
    setReturnItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, kondisi } : it))
    );
  }

  const checkedItems = returnItems.filter((it) => it.checked && it.return_qty > 0);
  const goodCount = checkedItems.filter((it) => it.kondisi === "bagus").length;
  const badCount = checkedItems.filter((it) => it.kondisi === "rusak").length;

  async function handleSubmit() {
    setConfirm(false);
    setSubmitting(true);
    try {
      const res = await adjustmentsApi.create({
        type: "sales_return",
        reference_sale_id: selected.id,
        alasan,
        catatan: catatan || null,
        items: checkedItems.map((it) => ({
          product_id: it.product_id,
          qty: it.return_qty,
          kondisi: it.kondisi,
          harga_satuan: it.harga_satuan,
        })),
      });

      qc.invalidateQueries({ queryKey: ["adjustments"] });
      qc.invalidateQueries({ queryKey: ["notif-pending-approval"] });

      if (res.data?.status === "pending") {
        // Kasir flow: show Manager Override popup
        toast.info("Retur dibuat — menunggu persetujuan admin");
        setOverrideData({
          adjustmentId: res.data.id,
          kode: res.data.kode_adjustment,
        });
        setPinUsername("");
        setPinPassword("");
        setPinError("");
      } else {
        // Admin flow: auto-approved
        toast.success(res.message || "Retur pelanggan berhasil");
        resetForm();
      }
    } catch (err) {
      toast.error(err.message || "Gagal menyimpan retur");
    } finally {
      setSubmitting(false);
    }
  }

  // Opsi A: verifikasi PIN admin di layar kasir
  async function handlePinApprove() {
    if (!pinUsername.trim() || !pinPassword.trim()) {
      setPinError("Username dan password admin wajib diisi");
      return;
    }
    setPinSubmitting(true);
    setPinError("");
    try {
      const res = await adjustmentsApi.approvePin(overrideData.adjustmentId, {
        username: pinUsername.trim(),
        password: pinPassword,
      });
      toast.success(res.message || "Retur disetujui!");
      setOverrideData(null);
      resetForm();
      qc.invalidateQueries({ queryKey: ["adjustments"] });
      qc.invalidateQueries({ queryKey: ["notif-pending-approval"] });
    } catch (err) {
      setPinError(err.message || "Gagal memverifikasi");
    } finally {
      setPinSubmitting(false);
    }
  }

  if (!selected && !overrideData) {
    return (
      <Card className="p-5">
        <h3 className="mb-3 font-semibold text-slate-800">
          Cari Transaksi Penjualan
        </h3>

        {user?.role === "kasir" && (
          <div className="mb-3 rounded-lg bg-blue-50 px-4 py-2.5 text-xs text-blue-700">
            <strong>Info:</strong> Retur pelanggan membutuhkan persetujuan admin
            (Manager Override). Setelah submit, admin bisa menyetujui via PIN
            langsung di layar ini atau dari Dashboard Admin.
          </div>
        )}

        <input
          placeholder="Filter kode transaksi..."
          value={kodeQ}
          onChange={(e) => {
            setKodeQ(e.target.value);
            fetchSales(e.target.value);
          }}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
        />

        <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
          {searching && (
            <div className="py-4 text-center">
              <Spinner />
            </div>
          )}
          {!searching && sales.length === 0 && (
            <p className="py-4 text-center text-sm text-slate-400">
              Tidak ada transaksi ditemukan
            </p>
          )}
          {!searching &&
            sales.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => selectSale(s)}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-4 py-3 text-left hover:border-brand-400 hover:bg-brand-50"
              >
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {s.kode_transaksi}
                  </p>
                  <p className="text-xs text-slate-400">
                    {tanggalJam(s.created_at)} · {s.items?.length || 0} item
                  </p>
                </div>
                <p className="text-sm font-semibold text-slate-700">
                  {rupiah(s.total_harga)}
                </p>
              </button>
            ))}
        </div>
      </Card>
    );
  }

  // Manager Override modal (Opsi A on-site + Opsi B remote waiting)
  if (overrideData) {
    return (
      <Card className="p-5">
        <div className="mx-auto max-w-md text-center">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          </div>

          <h3 className="mb-1 text-lg font-semibold text-slate-800">
            Menunggu Persetujuan Admin
          </h3>
          <p className="mb-1 text-sm text-slate-500">
            Retur <span className="font-mono font-medium">{overrideData.kode}</span> telah
            dibuat dan sedang menunggu persetujuan.
          </p>
          <p className="mb-6 text-xs text-slate-400">
            Notifikasi sudah terkirim ke Dashboard Admin secara real-time.
          </p>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-left">
            <h4 className="mb-3 text-sm font-semibold text-slate-700">
              Opsi A: Admin di Toko (Input Password)
            </h4>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Username Admin
                </label>
                <input
                  type="text"
                  value={pinUsername}
                  onChange={(e) => setPinUsername(e.target.value)}
                  placeholder="Username admin..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Password Admin
                </label>
                <input
                  type="password"
                  value={pinPassword}
                  onChange={(e) => setPinPassword(e.target.value)}
                  placeholder="Password admin..."
                  onKeyDown={(e) => e.key === "Enter" && handlePinApprove()}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                  autoComplete="off"
                />
              </div>
              {pinError && (
                <p className="text-xs font-medium text-red-600">{pinError}</p>
              )}
              <Button
                onClick={handlePinApprove}
                disabled={pinSubmitting}
                className="w-full"
              >
                {pinSubmitting ? "Memverifikasi..." : "Verifikasi & Setujui"}
              </Button>
            </div>

            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-xs text-slate-400">atau</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <div className="text-center">
              <h4 className="mb-2 text-sm font-semibold text-slate-700">
                Opsi B: Admin di Luar (Remote)
              </h4>
              <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-400" />
                Menunggu persetujuan remote dari admin...
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Halaman ini akan otomatis terupdate saat admin menyetujui.
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setOverrideData(null);
              resetForm();
            }}
            className="mt-4 text-xs text-slate-400 hover:text-slate-600"
          >
            Tutup (retur tetap pending)
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-800">
            Retur Transaksi: {selected.kode_transaksi}
          </h3>
          <p className="text-xs text-slate-400">{tanggalJam(selected.created_at)}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
          Change Transaction
        </Button>
      </div>

      <div className="mb-3 rounded-lg bg-blue-50 px-4 py-2.5 text-xs text-blue-700">
        <strong>Info:</strong> Kondisi &ldquo;Bagus&rdquo; = stok kembali bertambah.
        Kondisi &ldquo;Rusak&rdquo; = stok <strong>tidak</strong> bertambah (dicatat
        sebagai barang reject).
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-2 pr-2">Pilih</th>
              <th className="py-2 pr-2">Barang</th>
              <th className="py-2 pr-2 text-right">Qty Beli</th>
              <th className="py-2 pr-2 text-right">Harga</th>
              <th className="py-2 pr-2 text-right">Qty Retur</th>
              <th className="py-2">Kondisi</th>
            </tr>
          </thead>
          <tbody>
            {returnItems.map((it, idx) => (
              <tr key={it.id} className="border-b border-slate-100">
                <td className="py-2 pr-2">
                  <input
                    type="checkbox"
                    checked={it.checked}
                    onChange={() => toggleItem(idx)}
                    className="rounded"
                  />
                </td>
                <td className="py-2 pr-2">
                  <p className="font-medium text-slate-800">{it.nama_barang}</p>
                  <p className="text-xs text-slate-400">{it.kode_barang}</p>
                </td>
                <td className="py-2 pr-2 text-right">{angka(it.qty)}</td>
                <td className="py-2 pr-2 text-right">{rupiah(it.harga_satuan)}</td>
                <td className="py-2 pr-2 text-right">
                  {it.checked ? (
                    <input
                      type="number"
                      min={1}
                      max={it.qty}
                      value={it.return_qty}
                      onChange={(e) =>
                        setQty(idx, parseInt(e.target.value) || 0)
                      }
                      className="w-20 rounded border border-slate-300 px-2 py-1 text-right text-sm"
                    />
                  ) : (
                    <span className="text-slate-300">-</span>
                  )}
                </td>
                <td className="py-2">
                  {it.checked ? (
                    <select
                      value={it.kondisi}
                      onChange={(e) => setKondisi(idx, e.target.value)}
                      className="rounded border border-slate-300 px-2 py-1 text-sm"
                    >
                      <option value="bagus">Bagus</option>
                      <option value="rusak">Rusak</option>
                    </select>
                  ) : (
                    <span className="text-slate-300">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Alasan Retur <span className="text-red-500">*</span>
          </label>
          <textarea
            value={alasan}
            onChange={(e) => setAlasan(e.target.value)}
            placeholder="Contoh: Pelanggan mengembalikan karena salah ukuran..."
            rows={2}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <Input
          label="Catatan (opsional)"
          value={catatan}
          onChange={(e) => setCatatan(e.target.value)}
          placeholder="Catatan tambahan..."
        />
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-slate-500">
          <p>
            {checkedItems.length} item dipilih
            {goodCount > 0 && (
              <>{" "}<Badge tone="green">{goodCount} bagus (stok +)</Badge></>
            )}{" "}
            {badCount > 0 && (
              <Badge tone="red">{badCount} rusak (stok tetap)</Badge>
            )}
          </p>
        </div>
        <Button
          onClick={() => setConfirm(true)}
          disabled={checkedItems.length === 0 || !alasan.trim() || submitting}
          variant="primary"
        >
          {submitting ? "Processing..." : "Process Return"}
        </Button>
      </div>

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={handleSubmit}
        title="Konfirmasi Retur Pelanggan"
        message={
          user?.role === "kasir"
            ? `${goodCount} barang kondisi bagus, ${badCount} barang kondisi rusak. Retur akan menunggu persetujuan admin. Lanjutkan?`
            : `${goodCount} barang kondisi bagus (stok bertambah), ${badCount} barang kondisi rusak (stok tidak bertambah). Lanjutkan?`
        }
      />
    </Card>
  );
}

// ======================== PENYESUAIAN STOK (ADMIN ONLY) ========================

function PenyesuaianStokForm() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [alasan, setAlasan] = useState("");
  const [catatan, setCatatan] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function addProduct(product) {
    if (items.some((it) => it.product_id === product.id)) {
      toast.info("Barang sudah ada di daftar");
      return;
    }
    setItems((prev) => [
      ...prev,
      {
        product_id: product.id,
        kode_barang: product.kode_barang,
        nama_barang: product.nama_barang,
        merk: product.merk,
        stok: product.stok,
        harga_beli: Number(product.harga_beli),
        qty: 1,
      },
    ]);
  }

  function removeItem(idx) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function setQty(idx, val) {
    setItems((prev) =>
      prev.map((it, i) =>
        i === idx ? { ...it, qty: Math.max(1, Math.min(val, it.stok)) } : it
      )
    );
  }

  async function handleSubmit() {
    setConfirm(false);
    setSubmitting(true);
    try {
      const res = await adjustmentsApi.create({
        type: "stock_adjustment",
        alasan,
        catatan: catatan || null,
        items: items.map((it) => ({
          product_id: it.product_id,
          qty: it.qty,
          harga_satuan: it.harga_beli,
        })),
      });
      toast.success(res.message || "Penyesuaian stok berhasil");
      setItems([]);
      setAlasan("");
      setCatatan("");
    } catch (err) {
      toast.error(err.message || "Gagal menyimpan penyesuaian");
    } finally {
      setSubmitting(false);
    }
  }

  const totalQty = items.reduce((s, it) => s + it.qty, 0);

  return (
    <Card className="p-5">
      <div className="mb-3 rounded-lg bg-amber-50 px-4 py-2.5 text-xs text-amber-700">
        <strong>Penyesuaian Stok (Penyusutan):</strong> Gunakan fitur ini untuk
        mencatat barang yang rusak, pecah, hilang, atau penyusutan stok di toko.
        Stok akan <strong>berkurang</strong> sesuai jumlah yang diinput.
        <br />
        <strong>Hanya admin</strong> yang berhak melakukan penyesuaian stok untuk
        mencegah penyalahgunaan.
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-slate-800">Daftar Barang</h3>
        <Button size="sm" onClick={() => setPickerOpen(true)}>
          + Add Item
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="Belum ada barang"
          description="Klik 'Tambah Barang' untuk memilih barang yang akan disesuaikan"
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="py-2 pr-2">Barang</th>
                <th className="py-2 pr-2 text-right">Stok Saat Ini</th>
                <th className="py-2 pr-2 text-right">Harga Beli</th>
                <th className="py-2 pr-2 text-right">Qty Dikurangi</th>
                <th className="py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => (
                <tr key={it.product_id} className="border-b border-slate-100">
                  <td className="py-2 pr-2">
                    <p className="font-medium text-slate-800">{it.nama_barang}</p>
                    <p className="text-xs text-slate-400">
                      {it.kode_barang} · {it.merk || "-"}
                    </p>
                  </td>
                  <td className="py-2 pr-2 text-right">{angka(it.stok)}</td>
                  <td className="py-2 pr-2 text-right">{rupiah(it.harga_beli)}</td>
                  <td className="py-2 pr-2 text-right">
                    <input
                      type="number"
                      min={1}
                      max={it.stok}
                      value={it.qty}
                      onChange={(e) => setQty(idx, parseInt(e.target.value) || 1)}
                      className="w-20 rounded border border-slate-300 px-2 py-1 text-right text-sm"
                    />
                  </td>
                  <td className="py-2 text-center">
                    <button
                      onClick={() => removeItem(idx)}
                      className="text-red-400 hover:text-red-600"
                      title="Hapus"
                    >
                      &times;
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Alasan Penyesuaian <span className="text-red-500">*</span>
          </label>
          <textarea
            value={alasan}
            onChange={(e) => setAlasan(e.target.value)}
            placeholder="Contoh: Barang pecah tersenggol, rusak karena kelembaban, hilang saat stock opname..."
            rows={2}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <Input
          label="Catatan (opsional)"
          value={catatan}
          onChange={(e) => setCatatan(e.target.value)}
          placeholder="Catatan tambahan..."
        />
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {items.length} barang · Total qty dikurangi:{" "}
          <strong>{angka(totalQty)}</strong>
        </p>
        <Button
          onClick={() => setConfirm(true)}
          disabled={items.length === 0 || !alasan.trim() || submitting}
          variant="danger"
        >
          {submitting ? "Processing..." : "Proses Stock Adjustment"}
        </Button>
      </div>

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={handleSubmit}
        title="Konfirmasi Penyesuaian Stok"
        message={`Stok ${items.length} barang akan BERKURANG sebanyak ${angka(totalQty)} unit total. Tindakan ini tidak bisa dibatalkan. Lanjutkan?`}
        tone="danger"
      />

      <ProductPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={addProduct}
      />
    </Card>
  );
}

// ======================== PENDING APPROVAL (ADMIN) ========================

function PendingApprovalTab() {
  const toast = useToast();
  const qc = useQueryClient();

  const { data: listData, isLoading } = useQuery({
    queryKey: ["adjustments-pending"],
    queryFn: () => adjustmentsApi.list({ status: "pending", limit: 50 }),
    refetchInterval: 5000,
  });
  const pendingItems = listData?.data || [];

  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [rejectId, setRejectId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [processing, setProcessing] = useState(null);

  async function openDetail(id) {
    setDetailLoading(true);
    try {
      const res = await adjustmentsApi.get(id);
      setDetail(res.data);
    } catch {
      toast.error("Gagal memuat detail");
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleApprove(id) {
    setProcessing(id);
    try {
      await adjustmentsApi.approve(id);
      toast.success("Retur pelanggan berhasil disetujui");
      qc.invalidateQueries({ queryKey: ["adjustments-pending"] });
      qc.invalidateQueries({ queryKey: ["adjustments"] });
      qc.invalidateQueries({ queryKey: ["notif-pending-approval"] });
      if (detail?.id === id) setDetail(null);
    } catch (err) {
      toast.error(err.message || "Gagal menyetujui");
    } finally {
      setProcessing(null);
    }
  }

  async function handleReject() {
    if (!rejectId) return;
    setProcessing(rejectId);
    try {
      await adjustmentsApi.reject(rejectId, rejectReason);
      toast.success("Retur pelanggan ditolak");
      qc.invalidateQueries({ queryKey: ["adjustments-pending"] });
      qc.invalidateQueries({ queryKey: ["adjustments"] });
      qc.invalidateQueries({ queryKey: ["notif-pending-approval"] });
      setRejectId(null);
      setRejectReason("");
      if (detail?.id === rejectId) setDetail(null);
    } catch (err) {
      toast.error(err.message || "Gagal menolak");
    } finally {
      setProcessing(null);
    }
  }

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

        {isLoading && <Spinner label="Memuat..." />}

        {!isLoading && pendingItems.length === 0 && (
          <EmptyState
            title="Tidak ada retur pending"
            description="Semua retur pelanggan sudah diproses"
          />
        )}

        {!isLoading && pendingItems.length > 0 && (
          <div className="space-y-3">
            {pendingItems.map((row) => (
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
                    onClick={() => openDetail(row.id)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Detail
                  </button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      setRejectId(row.id);
                      setRejectReason("");
                    }}
                    disabled={processing === row.id}
                  >
                    Tolak
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleApprove(row.id)}
                    disabled={processing === row.id}
                  >
                    {processing === row.id ? "..." : "Setujui"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Detail Modal */}
      <Modal
        open={!!detail || detailLoading}
        onClose={() => setDetail(null)}
        title={detail ? `Detail ${detail.kode_adjustment}` : "Memuat..."}
        width="max-w-2xl"
      >
        {detailLoading && <Spinner label="Memuat detail..." />}
        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-slate-400">Tipe:</span>{" "}
                <Badge tone="blue">Retur Pelanggan</Badge>
              </div>
              <div>
                <span className="text-slate-400">Status:</span>{" "}
                <Badge tone={STATUS_BADGES[detail.status]?.tone || "slate"}>
                  {STATUS_BADGES[detail.status]?.label || detail.status}
                </Badge>
              </div>
              <div>
                <span className="text-slate-400">Dibuat oleh:</span>{" "}
                {detail.username || "-"}
              </div>
              <div>
                <span className="text-slate-400">Tanggal:</span>{" "}
                {tanggalJam(detail.created_at)}
              </div>
              <div className="col-span-2">
                <span className="text-slate-400">Alasan:</span>{" "}
                {detail.alasan}
              </div>
              {detail.catatan && (
                <div className="col-span-2">
                  <span className="text-slate-400">Catatan:</span>{" "}
                  {detail.catatan}
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
                {detail.items?.map((it) => (
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

            {detail.status === "pending" && (
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    setDetail(null);
                    setRejectId(detail.id);
                    setRejectReason("");
                  }}
                >
                  Tolak
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleApprove(detail.id)}
                  disabled={processing === detail.id}
                >
                  {processing === detail.id ? "Processing..." : "Confirm Return"}
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Reject confirmation */}
      <Modal
        open={!!rejectId}
        onClose={() => setRejectId(null)}
        title="Tolak Retur Pelanggan"
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Retur ini akan ditolak dan stok tidak akan berubah. Berikan alasan
            penolakan:
          </p>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Alasan penolakan (opsional)..."
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setRejectId(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleReject}
              disabled={processing === rejectId}
            >
              {processing === rejectId ? "Processing..." : "Confirm Reject"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

// ======================== RIWAYAT ========================

const HISTORY_PAGE_SIZE = 5;

function HistoryTab() {
  const toast = useToast();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [filterType, setFilterType] = useState("");
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [page, setPage] = useState(1);

  const load = useCallback(async (type) => {
    setLoading(true);
    setPage(1);
    try {
      const res = await adjustmentsApi.list({ type: type || undefined, limit: 200 });
      setData(res.data || []);
    } catch {
      toast.error("Gagal memuat riwayat");
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [toast]);

  if (!loaded && !loading) {
    load(filterType);
  }

  const totalPages = Math.max(1, Math.ceil(data.length / HISTORY_PAGE_SIZE));
  const pagedData = data.slice((page - 1) * HISTORY_PAGE_SIZE, page * HISTORY_PAGE_SIZE);

  async function openDetail(id) {
    setDetailLoading(true);
    try {
      const res = await adjustmentsApi.get(id);
      setDetail(res.data);
    } catch {
      toast.error("Gagal memuat detail");
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <>
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">Riwayat Retur & Penyesuaian</h3>
          <div className="flex gap-2">
            <select
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value);
                load(e.target.value);
              }}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="">Semua Tipe</option>
              <option value="return_supplier">Retur Supplier</option>
              <option value="sales_return">Retur Pelanggan</option>
              <option value="stock_adjustment">Penyesuaian Stok</option>
            </select>
            <Button size="sm" variant="secondary" onClick={() => load(filterType)}>
              Refresh
            </Button>
          </div>
        </div>

        {loading && <Spinner label="Memuat riwayat..." />}

        {!loading && data.length === 0 && (
          <EmptyState title="Belum ada riwayat" description="Semua retur dan penyesuaian stok akan tercatat di sini" />
        )}

        {!loading && data.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
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
                  {pagedData.map((row) => {
                    const tb = TYPE_BADGES[row.type] || { label: row.type, tone: "slate" };
                    const sb = STATUS_BADGES[row.status] || { label: row.status, tone: "slate" };
                    return (
                      <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50">
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
                            onClick={() => openDetail(row.id)}
                            className="text-xs text-brand-600 hover:underline"
                          >
                            Detail
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
              <p>{data.length} item · halaman {page}/{totalPages}</p>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium hover:bg-slate-50 disabled:opacity-40"
                >
                  Previous
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`rounded-lg border px-3 py-1 text-xs font-medium ${
                      p === page
                        ? "border-brand-500 bg-brand-500 text-white"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
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
        open={!!detail || detailLoading}
        onClose={() => setDetail(null)}
        title={detail ? `Detail ${detail.kode_adjustment}` : "Memuat..."}
        width="max-w-2xl"
      >
        {detailLoading && <Spinner label="Memuat detail..." />}
        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-slate-400">Tipe:</span>{" "}
                <Badge tone={TYPE_BADGES[detail.type]?.tone || "slate"}>
                  {TYPE_BADGES[detail.type]?.label || detail.type}
                </Badge>
              </div>
              <div>
                <span className="text-slate-400">Status:</span>{" "}
                <Badge tone={STATUS_BADGES[detail.status]?.tone || "slate"}>
                  {STATUS_BADGES[detail.status]?.label || detail.status}
                </Badge>
              </div>
              <div>
                <span className="text-slate-400">Dibuat oleh:</span>{" "}
                {detail.username || "-"}
              </div>
              <div>
                <span className="text-slate-400">Tanggal:</span>{" "}
                {tanggalJam(detail.created_at)}
              </div>
              {detail.approved_by_username && (
                <div>
                  <span className="text-slate-400">
                    {detail.status === "approved" ? "Disetujui" : "Ditolak"} oleh:
                  </span>{" "}
                  {detail.approved_by_username}
                </div>
              )}
              {detail.approved_at && (
                <div>
                  <span className="text-slate-400">Tanggal keputusan:</span>{" "}
                  {tanggalJam(detail.approved_at)}
                </div>
              )}
              <div className="col-span-2">
                <span className="text-slate-400">Total Qty:</span>{" "}
                {angka(detail.total_qty)}
              </div>
              <div className="col-span-2">
                <span className="text-slate-400">Alasan:</span>{" "}
                {detail.alasan}
              </div>
              {detail.catatan && (
                <div className="col-span-2">
                  <span className="text-slate-400">Catatan:</span>{" "}
                  {detail.catatan}
                </div>
              )}
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="py-2 pr-2">Barang</th>
                  <th className="py-2 pr-2 text-right">Qty</th>
                  {detail.type === "sales_return" && (
                    <th className="py-2 pr-2">Kondisi</th>
                  )}
                  <th className="py-2 text-right">Harga</th>
                </tr>
              </thead>
              <tbody>
                {detail.items?.map((it) => (
                  <tr key={it.id} className="border-b border-slate-100">
                    <td className="py-2 pr-2">
                      <p className="font-medium text-slate-800">{it.nama_barang}</p>
                      <p className="text-xs text-slate-400">{it.kode_barang}</p>
                    </td>
                    <td className="py-2 pr-2 text-right">{angka(it.qty)}</td>
                    {detail.type === "sales_return" && (
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
