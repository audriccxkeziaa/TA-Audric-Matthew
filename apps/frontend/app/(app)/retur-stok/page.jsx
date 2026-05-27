"use client";

import { useState, useCallback } from "react";
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

const TABS = [
  { id: "return_supplier", label: "Retur ke Supplier" },
  { id: "sales_return", label: "Retur Pelanggan" },
  { id: "stock_adjustment", label: "Penyesuaian Stok" },
  { id: "history", label: "Riwayat" },
];

const TYPE_BADGES = {
  return_supplier: { label: "Retur Supplier", tone: "amber" },
  sales_return: { label: "Retur Pelanggan", tone: "blue" },
  stock_adjustment: { label: "Penyesuaian Stok", tone: "red" },
};

// ======================== MAIN PAGE ========================

export default function ReturStokPage() {
  const [tab, setTab] = useState("return_supplier");

  return (
    <PageShell>
      <PageHeader
        title="Retur & Penyesuaian Stok"
        description="Kelola retur supplier, retur pelanggan, dan penyesuaian stok (penyusutan)"
      />

      {/* Tab bar */}
      <div className="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
              tab === t.id
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "return_supplier" && <ReturSupplierForm />}
      {tab === "sales_return" && <ReturPelangganForm />}
      {tab === "stock_adjustment" && <PenyesuaianStokForm />}
      {tab === "history" && <HistoryTab />}
    </PageShell>
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

  async function searchPurchases() {
    setSearching(true);
    try {
      const res = await adjustmentsApi.lookupPurchase(notaQ);
      setPurchases(res.data || []);
      if ((res.data || []).length === 0) toast.info("Tidak ditemukan pembelian");
    } catch (err) {
      toast.error(err.message || "Gagal mencari");
    } finally {
      setSearching(false);
    }
  }

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
      setPurchases([]);
      setNotaQ("");
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
          Cari Nota Pembelian Supplier
        </h3>
        <div className="flex gap-2">
          <input
            placeholder="No. nota supplier (kosongkan untuk tampilkan terbaru)..."
            value={notaQ}
            onChange={(e) => setNotaQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && searchPurchases()}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
          />
          <Button onClick={searchPurchases} disabled={searching}>
            {searching ? "Mencari..." : "Cari"}
          </Button>
        </div>

        {purchases.length > 0 && (
          <div className="mt-4 space-y-2">
            {purchases.map((p) => (
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
        )}
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
          Ganti Nota
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
          {submitting ? "Memproses..." : "Proses Retur Supplier"}
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

// ======================== RETUR PELANGGAN ========================

function ReturPelangganForm() {
  const toast = useToast();
  const [kodeQ, setKodeQ] = useState("");
  const [sales, setSales] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [returnItems, setReturnItems] = useState([]);
  const [alasan, setAlasan] = useState("");
  const [catatan, setCatatan] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function searchSales() {
    if (!kodeQ.trim()) {
      toast.info("Masukkan kode transaksi");
      return;
    }
    setSearching(true);
    try {
      const res = await adjustmentsApi.lookupSale(kodeQ.trim());
      setSales(res.data || []);
      if ((res.data || []).length === 0) toast.info("Transaksi tidak ditemukan");
    } catch (err) {
      toast.error(err.message || "Gagal mencari");
    } finally {
      setSearching(false);
    }
  }

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
      toast.success(res.message || "Retur pelanggan berhasil");
      setSelected(null);
      setReturnItems([]);
      setAlasan("");
      setCatatan("");
      setSales([]);
      setKodeQ("");
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
          Cari Transaksi Penjualan
        </h3>
        <div className="flex gap-2">
          <input
            placeholder="Kode transaksi (misal: INV-20260528-...)..."
            value={kodeQ}
            onChange={(e) => setKodeQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && searchSales()}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
          />
          <Button onClick={searchSales} disabled={searching}>
            {searching ? "Mencari..." : "Cari"}
          </Button>
        </div>

        {sales.length > 0 && (
          <div className="mt-4 space-y-2">
            {sales.map((s) => (
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
        )}
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
          Ganti Transaksi
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
              <Badge tone="green">{goodCount} bagus (stok +)</Badge>
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
          {submitting ? "Memproses..." : "Proses Retur Pelanggan"}
        </Button>
      </div>

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={handleSubmit}
        title="Konfirmasi Retur Pelanggan"
        message={`${goodCount} barang kondisi bagus (stok bertambah), ${badCount} barang kondisi rusak (stok tidak bertambah). Lanjutkan?`}
      />
    </Card>
  );
}

// ======================== PENYESUAIAN STOK ========================

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
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-slate-800">Daftar Barang</h3>
        <Button size="sm" onClick={() => setPickerOpen(true)}>
          + Tambah Barang
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
          {submitting ? "Memproses..." : "Proses Penyesuaian Stok"}
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

// ======================== RIWAYAT ========================

function HistoryTab() {
  const toast = useToast();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [filterType, setFilterType] = useState("");
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async (type) => {
    setLoading(true);
    try {
      const res = await adjustmentsApi.list({ type: type || undefined, limit: 100 });
      setData(res.data || []);
    } catch (err) {
      toast.error("Gagal memuat riwayat");
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [toast]);

  // Auto-load on first render
  if (!loaded && !loading) {
    load(filterType);
  }

  async function openDetail(id) {
    setDetailLoading(true);
    try {
      const res = await adjustmentsApi.get(id);
      setDetail(res.data);
    } catch (err) {
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="py-2 pr-2">Kode</th>
                  <th className="py-2 pr-2">Tipe</th>
                  <th className="py-2 pr-2">User</th>
                  <th className="py-2 pr-2">Alasan</th>
                  <th className="py-2 pr-2 text-right">Total Qty</th>
                  <th className="py-2 pr-2">Tanggal</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => {
                  const b = TYPE_BADGES[row.type] || { label: row.type, tone: "slate" };
                  return (
                    <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-2 pr-2 font-mono text-xs">{row.kode_adjustment}</td>
                      <td className="py-2 pr-2">
                        <Badge tone={b.tone}>{b.label}</Badge>
                      </td>
                      <td className="py-2 pr-2">{row.username || "-"}</td>
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
                <span className="text-slate-400">User:</span>{" "}
                {detail.username || "-"}
              </div>
              <div>
                <span className="text-slate-400">Tanggal:</span>{" "}
                {tanggalJam(detail.created_at)}
              </div>
              <div>
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
