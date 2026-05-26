"use client";
// =================================================================
// /laporan — Laporan Penjualan & Pembelian (admin)
// =================================================================
// Tabel grouped per transaksi/nota. Klik baris → modal detail items.
// =================================================================

import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { reportsApi, salesApi } from "@/lib/api";
import { downloadFile } from "@/lib/api-client";
import { useToast } from "@/hooks/useToast";
import { rupiah, angka, tanggalJam, tanggal, isoDate } from "@/lib/format";
import {
  PageShell,
  PageHeader,
  Card,
  Button,
  Input,
  StatCard,
  Modal,
  Spinner,
  EmptyState,
} from "@/components/ui";

// Group flat rows by a key into array of { key, ...aggregated, items[] }
function groupSalesRows(rows) {
  const map = new Map();
  for (const r of rows) {
    const key = r.sale_id;
    if (!map.has(key)) {
      map.set(key, {
        sale_id: r.sale_id,
        kode_transaksi: r.kode_transaksi,
        created_at: r.sale_created_at,
        kasir: r.kasir,
        total: 0,
        total_qty: 0,
        item_count: 0,
        items: [],
      });
    }
    const g = map.get(key);
    g.total += Number(r.subtotal);
    g.total_qty += Number(r.qty);
    g.item_count += 1;
    g.items.push(r);
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );
}

function groupPurchaseRows(rows) {
  const map = new Map();
  for (const r of rows) {
    const key = r.purchase_id;
    if (!map.has(key)) {
      map.set(key, {
        purchase_id: r.purchase_id,
        no_nota: r.no_nota,
        created_at: r.purchase_created_at,
        user: r.user,
        status_validasi: r.status_validasi,
        nota_diskon_persen: Number(r.nota_diskon_persen || 0),
        nota_potongan_harga: Number(r.nota_potongan_harga || 0),
        diskon_nilai: Number(r.diskon_nilai || 0),
        subtotal_before_diskon: 0,
        total: 0,
        total_qty: 0,
        item_count: 0,
        items: [],
      });
    }
    const g = map.get(key);
    g.subtotal_before_diskon += Number(r.subtotal);
    g.total = g.subtotal_before_diskon - g.diskon_nilai;
    g.total_qty += Number(r.qty);
    g.item_count += 1;
    g.items.push(r);
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );
}

const PAGE_SIZE = 20;

export default function LaporanPage() {
  const toast = useToast();
  const [tab, setTab] = useState("penjualan");
  const [from, setFrom] = useState(isoDate(-30));
  const [to, setTo] = useState(isoDate(0));
  const [kasirFilter, setKasirFilter] = useState("");
  const [page, setPage] = useState(1);
  const [detailData, setDetailData] = useState(null); // grouped object with items[]

  const isSales = tab === "penjualan";
  const query = { from, to };

  // Reset page & kasir filter when tab or date changes
  useEffect(() => { setPage(1); setKasirFilter(""); }, [tab, from, to]);

  const { data, isLoading } = useQuery({
    queryKey: ["laporan", tab, from, to],
    queryFn: () =>
      isSales ? reportsApi.sales(query) : reportsApi.purchases(query),
  });
  const rawRows = data?.data || [];
  const summary = data?.summary || {};

  const grouped = useMemo(
    () => (isSales ? groupSalesRows(rawRows) : groupPurchaseRows(rawRows)),
    [rawRows, isSales]
  );

  // Unique kasir/user options from data
  const kasirOptions = useMemo(() => {
    const names = grouped
      .map((g) => (isSales ? g.kasir : g.user))
      .filter(Boolean);
    return [...new Set(names)].sort();
  }, [grouped, isSales]);

  // Filter by kasir
  const filteredGrouped = useMemo(() => {
    if (!kasirFilter) return grouped;
    return grouped.filter((g) =>
      isSales ? g.kasir === kasirFilter : g.user === kasirFilter
    );
  }, [grouped, kasirFilter, isSales]);

  // Paginate
  const totalPages = Math.max(1, Math.ceil(filteredGrouped.length / PAGE_SIZE));
  const paginatedGrouped = filteredGrouped.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  async function exportCsv() {
    try {
      await downloadFile(isSales ? "/reports/sales" : "/reports/purchases", {
        query: { ...query, format: "csv" },
        filename: `laporan-${tab}_${isoDate()}.csv`,
      });
      toast.success("CSV diunduh");
    } catch (e) {
      toast.error(e.message || "Gagal mengunduh CSV");
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Laporan"
        description="Berisi rekap transaksi penjualan dan pembelian spareparts."
        actions={
          <div className="flex gap-2 no-print">
            <Button variant="outline" onClick={exportCsv}>
              Export CSV
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              Print PDF
            </Button>
          </div>
        }
      />

      {/* Tab */}
      <div className="mb-3 flex shrink-0 gap-1 no-print">
        <button
          onClick={() => { setTab("penjualan"); setDetailData(null); }}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            isSales
              ? "bg-brand-600 text-white shadow-sm"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          Transaction (Stock Out)
        </button>
        <button
          onClick={() => { setTab("pembelian"); setDetailData(null); }}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            !isSales
              ? "bg-brand-600 text-white shadow-sm"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          Purchase (Stock In)
        </button>
      </div>

      {/* Filter tanggal + kasir */}
      <Card className="mb-3 shrink-0 p-3 no-print">
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
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {isSales ? "Kasir" : "Input Oleh"}
            </label>
            <select
              value={kasirFilter}
              onChange={(e) => { setKasirFilter(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Semua {isSales ? "Kasir" : "User"}</option>
              {kasirOptions.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => { setKasirFilter(""); setFrom(isoDate(-30)); setTo(isoDate(0)); setPage(1); }}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              Reset Filter
            </button>
          </div>
        </div>
      </Card>

      {/* Judul cetak */}
      <div className="mb-3 hidden shrink-0 print:block">
        <h2 className="text-lg font-bold">
          Laporan {isSales ? "Penjualan" : "Pembelian"} — CV Asia Jaya Maju
        </h2>
        <p className="text-sm">
          Periode {tanggal(from)} s/d {tanggal(to)}
        </p>
      </div>

      {/* Ringkasan */}
      <div className="mb-3 grid shrink-0 gap-3 sm:grid-cols-4">
        {isSales ? (
          <>
            <StatCard
              label="Total Transaksi"
              value={angka(summary.total_transactions || 0)}
            />
            <StatCard
              label="Total Item Terjual"
              value={angka(summary.total_qty || 0)}
            />
            <StatCard
              label="Total Baris"
              value={angka(summary.total_items || 0)}
            />
            <StatCard
              label="Total Revenue"
              value={rupiah(summary.total_revenue || 0)}
              tone="good"
            />
          </>
        ) : (
          <>
            <StatCard
              label="Total Nota"
              value={angka(summary.total_purchases || 0)}
            />
            <StatCard
              label="Total Item Masuk"
              value={angka(summary.total_qty || 0)}
            />
            <StatCard
              label="Total Baris"
              value={angka(summary.total_items || 0)}
            />
            <StatCard
              label="Total Nilai Pembelian"
              value={rupiah(summary.total_value || 0)}
            />
          </>
        )}
      </div>

      {/* Tabel Grouped */}
      <Card className="flex min-h-0 flex-1 flex-col p-0">
        {isLoading ? (
          <div className="p-6">
            <Spinner label="Memuat laporan..." />
          </div>
        ) : filteredGrouped.length === 0 ? (
          <EmptyState title="Tidak ada data pada periode ini" />
        ) : (
          <div className="min-h-0 flex-1 overflow-auto thin-scroll">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs uppercase text-slate-500">
                {isSales ? (
                  <tr>
                    <th className="px-3 py-2.5 w-8">#</th>
                    <th className="px-3 py-2.5">Tanggal</th>
                    <th className="px-3 py-2.5">Kode Transaksi</th>
                    <th className="px-3 py-2.5">Kasir</th>
                    <th className="px-3 py-2.5 text-center">Jml Item</th>
                    <th className="px-3 py-2.5 text-right">Total Qty</th>
                    <th className="px-3 py-2.5 text-right">Total</th>
                    <th className="px-3 py-2.5 text-center no-print">Aksi</th>
                  </tr>
                ) : (
                  <tr>
                    <th className="px-3 py-2.5 w-8">#</th>
                    <th className="px-3 py-2.5">Tanggal</th>
                    <th className="px-3 py-2.5">No. Nota</th>
                    <th className="px-3 py-2.5">Input Oleh</th>
                    <th className="px-3 py-2.5 text-center">Jml Item</th>
                    <th className="px-3 py-2.5 text-right">Total Qty</th>
                    <th className="px-3 py-2.5 text-right">Total Nilai</th>
                    <th className="px-3 py-2.5 text-center no-print">Aksi</th>
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedGrouped.map((g, i) => (
                  <tr
                    key={isSales ? g.sale_id : g.purchase_id}
                    onClick={() => setDetailData(g)}
                    className="cursor-pointer transition-colors hover:bg-brand-50"
                  >
                    <td className="px-3 py-2.5 text-xs text-slate-400">
                      {(page - 1) * PAGE_SIZE + i + 1}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-xs">
                      {tanggalJam(g.created_at)}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-mono text-xs font-medium text-brand-700">
                        {isSales ? g.kode_transaksi : g.no_nota || "-"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">
                      {isSales ? g.kasir : g.user}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {g.item_count} item
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {angka(g.total_qty)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium tabular-nums">
                      {rupiah(g.total)}
                    </td>
                    <td className="px-3 py-2.5 text-center no-print">
                      <button
                        onClick={() => setDetailData(g)}
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

      {/* Pagination */}
      {filteredGrouped.length > PAGE_SIZE && (
        <div className="mt-2 flex shrink-0 items-center justify-between text-sm text-slate-500 no-print">
          <span>
            {filteredGrouped.length} baris · halaman {page}/{totalPages}
            {kasirFilter && ` · filter: ${kasirFilter}`}
          </span>
          <div className="flex gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded border border-slate-200 px-3 py-1 text-xs hover:bg-slate-50 disabled:opacity-40"
            >
              ← Sebelumnya
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded border border-slate-200 px-3 py-1 text-xs hover:bg-slate-50 disabled:opacity-40"
            >
              Berikutnya →
            </button>
          </div>
        </div>
      )}

      {/* Modal Detail */}
      <Modal
        open={Boolean(detailData)}
        onClose={() => setDetailData(null)}
        title={
          detailData
            ? isSales
              ? `Transaksi ${detailData.kode_transaksi}`
              : `Nota ${detailData.no_nota || "(tanpa nomor)"}`
            : "Detail"
        }
        width="max-w-2xl"
      >
        {detailData && (
          <div>
            {/* Header info */}
            <div className="mb-4 grid grid-cols-2 gap-x-6 gap-y-1 rounded-lg bg-slate-50 px-4 py-3 text-sm">
              <div>
                <span className="text-xs text-slate-400">Tanggal</span>
                <p className="font-medium">{tanggalJam(detailData.created_at)}</p>
              </div>
              <div>
                <span className="text-xs text-slate-400">
                  {isSales ? "Kasir" : "Diinput Oleh"}
                </span>
                <p className="font-medium">
                  {isSales ? detailData.kasir : detailData.user}
                </p>
              </div>
              {!isSales && detailData.status_validasi && (
                <div>
                  <span className="text-xs text-slate-400">Status</span>
                  <p className="font-medium capitalize">{detailData.status_validasi}</p>
                </div>
              )}
            </div>

            {/* Items table */}
            <div className="max-h-80 overflow-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase text-slate-500">
                  {isSales ? (
                    <tr>
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">Barang</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-right">Harga</th>
                      <th className="px-3 py-2 text-right">Diskon</th>
                      <th className="px-3 py-2 text-right">Subtotal</th>
                    </tr>
                  ) : (
                    <tr>
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">Barang</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-right">Harga Beli</th>
                      <th className="px-3 py-2 text-right">Subtotal</th>
                    </tr>
                  )}
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {detailData.items.map((it, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="px-3 py-2 text-xs text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-medium">{it.nama_barang}</span>
                        <span className="block font-mono text-xs text-slate-400">
                          {it.kode_barang}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {it.qty}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {rupiah(isSales ? it.harga_satuan : it.harga_beli)}
                      </td>
                      {isSales && (
                        <td className="px-3 py-2 text-right tabular-nums">
                          {Number(it.diskon_persen) > 0 ? (
                            <span className="font-medium text-rose-600">{it.diskon_persen}%</span>
                          ) : (
                            <span className="text-slate-300">0%</span>
                          )}
                        </td>
                      )}
                      <td className="px-3 py-2 text-right font-medium tabular-nums">
                        {rupiah(it.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer total */}
            <div className="mt-3 rounded-lg bg-brand-50 px-4 py-3">
              <div className="flex items-center justify-between text-sm text-slate-600">
                <span>
                  <span className="font-medium">{detailData.item_count}</span> item
                  {" "}·{" "}
                  <span className="font-medium">{angka(detailData.total_qty)}</span> qty
                </span>
                {!isSales && (
                  <span>
                    Subtotal: <span className="font-medium">{rupiah(detailData.subtotal_before_diskon || detailData.total)}</span>
                  </span>
                )}
              </div>
              {!isSales && detailData.nota_diskon_persen > 0 && (
                <div className="mt-2 flex items-center justify-between border-t border-brand-100 pt-2 text-sm">
                  <span className="text-slate-500">Diskon ({detailData.nota_diskon_persen}%)</span>
                  <span className="font-semibold text-rose-600">
                    −{rupiah(Math.round(detailData.subtotal_before_diskon * detailData.nota_diskon_persen / 100))}
                  </span>
                </div>
              )}
              {!isSales && detailData.nota_potongan_harga > 0 && (
                <div className={`flex items-center justify-between text-sm ${detailData.nota_diskon_persen > 0 ? "mt-1" : "mt-2 border-t border-brand-100 pt-2"}`}>
                  <span className="text-slate-500">Potongan Harga</span>
                  <span className="font-semibold text-rose-600">
                    −{rupiah(detailData.nota_potongan_harga)}
                  </span>
                </div>
              )}
              <div className={`flex items-center justify-between ${!isSales ? "mt-2 border-t border-brand-200 pt-2" : "mt-1"}`}>
                <span className="text-sm font-medium text-slate-700">Total</span>
                <p className="text-lg font-bold text-brand-700">
                  {rupiah(detailData.total)}
                </p>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <Button variant="secondary" onClick={() => setDetailData(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </PageShell>
  );
}
