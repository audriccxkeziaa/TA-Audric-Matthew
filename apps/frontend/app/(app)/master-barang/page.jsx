"use client";
// =================================================================
// /master-barang — CRUD Master Barang (kasir & admin)
// =================================================================
// - Cari & filter (status / kondisi stok)
// - Tambah & edit barang. Kolom stok TIDAK bisa diedit manual (R3).
// - min_stock hanya bisa diubah admin (RBAC field-level).
// - "Hapus" = soft delete → status nonaktif.
// =================================================================

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { productsApi } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { rupiah, angka } from "@/lib/format";
import {
  PageShell,
  PageHeader,
  Card,
  Button,
  Input,
  Select,
  Badge,
  Modal,
  Skeleton,
  EmptyState,
} from "@/components/ui";

// Badge kondisi stok berdasarkan stok vs min_stock.
function stokBadge(p) {
  if (Number(p.stok) === 0) return <Badge tone="red">Stok Habis</Badge>;
  if (Number(p.stok) <= Number(p.min_stock))
    return <Badge tone="amber">Stok Menipis</Badge>;
  return <Badge tone="green">Normal</Badge>;
}

// ---------- Form tambah / edit barang ----------
function ProductForm({ open, onClose, editing, isAdmin }) {
  const qc = useQueryClient();
  const toast = useToast();
  const isEdit = Boolean(editing);

  const [form, setForm] = useState(() => ({
    kode_barang: editing?.kode_barang || "",
    nama_barang: editing?.nama_barang || "",
    merk: editing?.merk || "",
    harga_beli: editing?.harga_beli ?? "",
    harga_jual: editing?.harga_jual ?? "",
    min_stock: editing?.min_stock ?? 0,
  }));
  const [alasan, setAlasan] = useState("");
  const [err, setErr] = useState("");

  // Waktu sekarang untuk ditampilkan di label alasan (audit trail)
  const nowLabel = new Date().toLocaleString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  const mutation = useMutation({
    mutationFn: async () => {
      // Validasi sisi klien sebelum kirim.
      if (!form.kode_barang.trim() || !form.nama_barang.trim()) {
        throw new Error("Kode dan nama barang wajib diisi");
      }
      if (isEdit && isAdmin && !alasan.trim()) {
        throw new Error(
          "Alasan perubahan wajib diisi (untuk audit trail)."
        );
      }
      const body = {
        kode_barang: form.kode_barang.trim(),
        nama_barang: form.nama_barang.trim(),
        merk: form.merk.trim() || null,
        harga_beli: Number(form.harga_beli) || 0,
        harga_jual: Number(form.harga_jual) || 0,
      };
      // min_stock hanya disertakan oleh admin (backend tolak kasir).
      if (isAdmin) body.min_stock = parseInt(form.min_stock, 10) || 0;

      if (isEdit) {
        if (isAdmin) body.alasan = alasan.trim();
        return productsApi.update(editing.id, body);
      }
      return productsApi.create(body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success(isEdit ? "Barang diperbarui" : "Barang ditambahkan");
      onClose();
    },
    onError: (e) => setErr(e.message),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Barang" : "Tambah Barang Baru"}
    >
      <div className="space-y-3">
        <Input
          label="Kode Barang"
          value={form.kode_barang}
          onChange={(e) => set("kode_barang", e.target.value)}
          placeholder="mis. SCM-001"
        />
        <Input
          label="Nama Barang"
          value={form.nama_barang}
          onChange={(e) => set("nama_barang", e.target.value)}
          placeholder="mis. Kampas Rem Beat"
        />
        <Input
          label="Merk"
          value={form.merk}
          onChange={(e) => set("merk", e.target.value)}
          placeholder="mis. Aspira"
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Harga Beli"
            type="number"
            min="0"
            value={form.harga_beli}
            onChange={(e) => set("harga_beli", e.target.value)}
          />
          <Input
            label="Harga Jual"
            type="number"
            min="0"
            value={form.harga_jual}
            onChange={(e) => set("harga_jual", e.target.value)}
          />
        </div>
        <Input
          label={`Min. Stok ${isAdmin ? "" : "(admin saja)"}`}
          type="number"
          min="0"
          value={form.min_stock}
          disabled={!isAdmin}
          onChange={(e) => set("min_stock", e.target.value)}
        />


        {/* Alasan perubahan — WAJIB saat edit (admin) untuk audit trail */}
        {isEdit && isAdmin && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Alasan Perubahan{" "}
              <span className="text-red-500">*</span>
            </label>
            <textarea
              value={alasan}
              onChange={(e) => setAlasan(e.target.value)}
              rows={3}
              placeholder="mis. Penyesuaian harga jual karena harga supplier naik / Koreksi nama barang typo"
              className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        )}

        {err && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {err}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              setErr("");
              mutation.mutate();
            }}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Menyimpan..." : "Save"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default function MasterBarangPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const [page, setPage] = useState(1);

  // Debounce: hanya kirim query ke backend 300ms setelah user berhenti mengetik
  useEffect(() => {
    const t = setTimeout(() => setQ(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const barcodeRef = useRef(null);
  const [barcodeInput, setBarcodeInput] = useState("");

  function normKode(k) {
    return (k || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  }

  function handleBarcodeSearch(e) {
    e.preventDefault();
    const code = barcodeInput.trim();
    if (!code) return;
    const norm = normKode(code);
    setSearchInput(norm);
    setQ(norm); // langsung set tanpa debounce untuk barcode
    setPage(1);
    setBarcodeInput("");
  }

  const { data, isLoading } = useQuery({
    queryKey: ["products", q, stockFilter, page],
    queryFn: () =>
      productsApi.list({
        q,
        status: "aktif",
        stock: stockFilter === "all" ? undefined : stockFilter,
        limit: 20,
        page,
      }),
  });
  const products = data?.data || [];
  const totalPages = data?.total_pages || 1;
  const total = data?.total || 0;

  return (
    <PageShell>
      <PageHeader
        title="Master Barang"
        description="Halaman untuk mengelola data spareparts. Stok tidak dapat diubah manual."
        actions={
          isAdmin && (
            <Button
              onClick={() => {
                setEditing(null);
                setShowForm(true);
              }}
            >
              + Add Items
            </Button>
          )
        }
      />

      {/* Barcode scanner input */}
      <Card className="mb-3 shrink-0 border-2 border-brand-400 p-3">
        <form onSubmit={handleBarcodeSearch} className="flex gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-lg bg-slate-50 px-3">
            <svg className="h-5 w-5 shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 5v14M7 5v14M11 5v14M15 5v14M19 5v14" />
            </svg>
            <input
              ref={barcodeRef}
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              placeholder="Scan barcode atau ketik kode produk lalu Enter…"
              className="flex-1 bg-transparent py-2 text-sm font-mono outline-none placeholder:text-slate-400"
            />
          </div>
          <Button type="submit" size="sm">Cari</Button>
          {searchInput && (
            <Button type="button" size="sm" variant="secondary" onClick={() => { setSearchInput(""); setQ(""); setPage(1); }}>
              Reset
            </Button>
          )}
        </form>
      </Card>

      {/* Filter — selalu terlihat */}
      <Card className="mb-3 shrink-0 p-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            placeholder="Cari nama / kode barang..."
            value={searchInput}
            onChange={(e) => { setSearchInput(e.target.value); setPage(1); }}
          />
          <Select
            value={stockFilter}
            onChange={(e) => { setStockFilter(e.target.value); setPage(1); }}
          >
            <option value="all">Semua Kondisi Stok</option>
            <option value="normal">Stok Normal</option>
            <option value="low">Stok Menipis</option>
            <option value="out">Stok Habis</option>
          </Select>
        </div>
      </Card>

      {/* Tabel — isi-nya yang scroll, kartu mengisi sisa tinggi */}
      <Card className="flex min-h-0 flex-1 flex-col p-0">
        {isLoading ? (
          <div className="p-4">
            <Skeleton rows={6} />
          </div>
        ) : products.length === 0 ? (
          <EmptyState
            title="Belum ada barang"
            description="Tambahkan barang atau ubah filter pencarian."
          />
        ) : (
          <div className="min-h-0 flex-1 overflow-auto thin-scroll">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Kode</th>
                  <th className="px-4 py-2.5">Nama Barang</th>
                  <th className="px-4 py-2.5">Merk</th>
                  <th className="px-4 py-2.5 text-right">Harga Beli</th>
                  <th className="px-4 py-2.5 text-right">Harga Jual</th>
                  <th className="px-4 py-2.5 text-right">Stok</th>
                  <th className="px-4 py-2.5 text-right">Min</th>
                  <th className="px-4 py-2.5">Kondisi</th>
                  {isAdmin && <th className="px-4 py-2.5 text-center">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-mono text-xs">
                      {p.kode_barang}
                    </td>
                    <td className="px-4 py-2.5">
                      {p.nama_barang}
                      {p.status === "nonaktif" && (
                        <span className="ml-2">
                          <Badge tone="slate">nonaktif</Badge>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">
                      {p.merk || "-"}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {rupiah(p.harga_beli)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {rupiah(p.harga_jual)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold">
                      {angka(p.stok)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-500">
                      {angka(p.min_stock)}
                    </td>
                    <td className="px-4 py-2.5">
                      {stokBadge(p)}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-2.5 text-center">
                        <button
                          onClick={() => {
                            setEditing(p);
                            setShowForm(true);
                          }}
                          className="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-slate-100 transition"
                          title="Edit barang"
                        >
                          <svg className="w-4 h-4 text-slate-600 hover:text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                          </svg>
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {total > 0 && (
        <div className="mt-2 flex shrink-0 items-center justify-between text-sm text-slate-500">
          <span>{total} items · pages {page}/{totalPages}</span>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}

      {showForm && (
        <ProductForm
          key={editing?.id || "new"}
          open={showForm}
          editing={editing}
          isAdmin={isAdmin}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}
    </PageShell>
  );
}
