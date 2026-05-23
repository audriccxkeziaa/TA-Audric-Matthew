"use client";
// =================================================================
// /laporan — Laporan Penjualan & Pembelian (admin)
// =================================================================
// Dua tab: Penjualan dan Pembelian (stok masuk). Layout 1 layar:
// tab, filter, dan kartu ringkasan tetap terlihat; hanya isi tabel
// yang scroll. Klik baris penjualan → modal detail transaksi.
// =================================================================

import { useState } from "react";
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

export default function LaporanPage() {
  const toast = useToast();
  const [tab, setTab] = useState("penjualan"); // penjualan | pembelian
  const [from, setFrom] = useState(isoDate(-30));
  const [to, setTo] = useState(isoDate(0));
  const [detailSaleId, setDetailSaleId] = useState(null);

  const isSales = tab === "penjualan";
  const query = { from, to };

  const { data, isLoading } = useQuery({
    queryKey: ["laporan", tab, from, to],
    queryFn: () =>
      isSales ? reportsApi.sales(query) : reportsApi.purchases(query),
  });
  const rows = data?.data || [];
  const summary = data?.summary || {};

  // Detail transaksi penjualan (pop-up, fetched on demand).
  const detailQ = useQuery({
    queryKey: ["sale-detail", detailSaleId],
    queryFn: () => salesApi.get(detailSaleId),
    enabled: Boolean(detailSaleId),
  });
  const detail = detailQ.data?.data;

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
        description="Rekap transaksi penjualan dan pembelian stok masuk."
        actions={
          <div className="flex gap-2 no-print">
            <Button variant="outline" onClick={exportCsv}>
              Export CSV
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              Cetak / PDF
            </Button>
          </div>
        }
      />

      {/* Tab — selalu terlihat */}
      <div className="mb-3 flex shrink-0 gap-1 no-print">
        <button
          onClick={() => setTab("penjualan")}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            isSales
              ? "bg-brand-600 text-white"
              : "bg-white text-slate-600 border border-slate-200"
          }`}
        >
          Penjualan
        </button>
        <button
          onClick={() => setTab("pembelian")}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            !isSales
              ? "bg-brand-600 text-white"
              : "bg-white text-slate-600 border border-slate-200"
          }`}
        >
          Pembelian (Stok Masuk)
        </button>
      </div>

      {/* Filter tanggal */}
      <Card className="mb-3 shrink-0 p-3 no-print">
        <div className="grid gap-3 sm:grid-cols-2">
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
        </div>
      </Card>

      {/* Judul cetak (hanya saat print) */}
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

      {/* Tabel — mengisi sisa tinggi */}
      <Card className="flex min-h-0 flex-1 flex-col p-0">
        {isLoading ? (
          <div className="p-6">
            <Spinner label="Memuat laporan..." />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState title="Tidak ada data pada periode ini" />
        ) : (
          <div className="min-h-0 flex-1 overflow-auto thin-scroll">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase text-slate-500">
                {isSales ? (
                  <tr>
                    <th className="px-3 py-2.5">Tanggal</th>
                    <th className="px-3 py-2.5">Kode Transaksi</th>
                    <th className="px-3 py-2.5">Kasir</th>
                    <th className="px-3 py-2.5">Barang</th>
                    <th className="px-3 py-2.5 text-right">Qty</th>
                    <th className="px-3 py-2.5 text-right">Harga</th>
                    <th className="px-3 py-2.5 text-right">Subtotal</th>
                    <th className="px-3 py-2.5 no-print" />
                  </tr>
                ) : (
                  <tr>
                    <th className="px-3 py-2.5">Tanggal</th>
                    <th className="px-3 py-2.5">No. Nota</th>
                    <th className="px-3 py-2.5">Input Oleh</th>
                    <th className="px-3 py-2.5">Barang</th>
                    <th className="px-3 py-2.5 text-right">Qty</th>
                    <th className="px-3 py-2.5 text-right">Harga Beli</th>
                    <th className="px-3 py-2.5 text-right">Diskon</th>
                    <th className="px-3 py-2.5 text-right">Subtotal</th>
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r, i) =>
                  isSales ? (
                    <tr
                      key={i}
                      onClick={() => setDetailSaleId(r.sale_id)}
                      className="cursor-pointer hover:bg-slate-50"
                    >
                      <td className="px-3 py-2 whitespace-nowrap text-xs">
                        {tanggalJam(r.sale_created_at)}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {r.kode_transaksi}
                      </td>
                      <td className="px-3 py-2">{r.kasir}</td>
                      <td className="px-3 py-2">
                        {r.nama_barang}
                        <span className="block text-xs text-slate-400">
                          {r.kode_barang}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">{r.qty}</td>
                      <td className="px-3 py-2 text-right">
                        {rupiah(r.harga_satuan)}
                      </td>
                      <td className="px-3 py-2 text-right font-medium">
                        {rupiah(r.subtotal)}
                      </td>
                      <td className="px-3 py-2 no-print">
                        <span className="text-xs text-brand-600">Detail →</span>
                      </td>
                    </tr>
                  ) : (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-3 py-2 whitespace-nowrap text-xs">
                        {tanggalJam(r.purchase_created_at)}
                      </td>
                      <td className="px-3 py-2">{r.no_nota || "-"}</td>
                      <td className="px-3 py-2">{r.user}</td>
                      <td className="px-3 py-2">
                        {r.nama_barang}
                        <span className="block text-xs text-slate-400">
                          {r.kode_barang}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">{r.qty}</td>
                      <td className="px-3 py-2 text-right">
                        {rupiah(r.harga_beli)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {r.diskon_persen || 0}%
                      </td>
                      <td className="px-3 py-2 text-right font-medium">
                        {rupiah(r.subtotal)}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal detail transaksi penjualan */}
      <Modal
        open={Boolean(detailSaleId)}
        onClose={() => setDetailSaleId(null)}
        title={detail ? `Transaksi ${detail.kode_transaksi}` : "Detail Transaksi"}
        width="max-w-xl"
      >
        {detailQ.isLoading || !detail ? (
          <div className="py-6">
            <Spinner label="Memuat detail..." />
          </div>
        ) : (
          <div>
            <p className="text-xs text-slate-500">
              {tanggalJam(detail.created_at)}
            </p>
            <table className="mt-3 w-full text-sm">
              <thead className="text-left text-xs uppercase text-slate-400">
                <tr>
                  <th className="py-1">Barang</th>
                  <th className="py-1 text-right">Qty</th>
                  <th className="py-1 text-right">Harga</th>
                  <th className="py-1 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {detail.items.map((it) => (
                  <tr key={it.id}>
                    <td className="py-1.5">
                      {it.nama_barang}
                      <span className="block text-xs text-slate-400">
                        {it.kode_barang}
                      </span>
                    </td>
                    <td className="py-1.5 text-right">{it.qty}</td>
                    <td className="py-1.5 text-right">
                      {rupiah(it.harga_satuan)}
                    </td>
                    <td className="py-1.5 text-right font-medium">
                      {rupiah(it.subtotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 font-bold">
              <span>Total</span>
              <span>{rupiah(detail.total_harga)}</span>
            </div>
          </div>
        )}
      </Modal>
    </PageShell>
  );
}
