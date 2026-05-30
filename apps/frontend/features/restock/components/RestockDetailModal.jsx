"use client";
// Modal detail produk + ubah min. stok (admin). Alasan wajib (audit trail).
// State & mutation di hook useRestockDetail; init value dari item.min_stock
// dipertahankan apa adanya (via setTimeout saat pertama render).

import { Modal, Button, Input } from "@/components/ui";
import { angka } from "@/lib/format";
import { UrgensiBadge } from "./UrgensiBadge";
import { useRestockDetail } from "../hooks/useRestockDetail";

export function RestockDetailModal({ item, onClose, viewOnly = false }) {
  const { value, setValue, alasan, setAlasan, save, reset } = useRestockDetail({
    item,
    onClose,
  });

  if (!item) return null;

  if (value === "" || value === undefined) {
    setTimeout(() => setValue(item.min_stock), 0);
  }

  function close() {
    onClose();
    reset();
  }

  return (
    <Modal
      open={!!item}
      onClose={close}
      title={viewOnly ? "Detail Produk Restock" : "Detail Produk & Ubah Min. Stok"}
      width="max-w-lg"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-xs text-slate-400">Kode Barang</span>
            <p className="font-mono font-medium">{item.kode_barang}</p>
          </div>
          <div>
            <span className="text-xs text-slate-400">Nama Barang</span>
            <p className="font-medium">{item.nama_barang}</p>
          </div>
          <div>
            <span className="text-xs text-slate-400">Merk</span>
            <p>{item.merk || "-"}</p>
          </div>
          <div>
            <span className="text-xs text-slate-400">Status</span>
            <div className="mt-0.5"><UrgensiBadge level={item.tingkat_urgensi} /></div>
          </div>
        </div>

        <div className="rounded-lg bg-slate-50 p-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-xs text-slate-400">Stok Saat Ini</span>
              <p className="text-lg font-bold">{angka(item.stok)}</p>
            </div>
            <div>
              <span className="text-xs text-slate-400">Min Stok</span>
              <p className="text-lg font-bold">{angka(item.min_stock)}</p>
            </div>
            <div>
              <span className="text-xs text-slate-400">Perlu Beli</span>
              <p className="font-semibold text-red-600">{angka(item.kekurangan)} unit</p>
            </div>
            <div>
              <span className="text-xs text-slate-400">Laju Jual/Hari</span>
              <p>
                {Number(item.avg_sales_30d || 0) === 0
                  ? "Belum ada data"
                  : `${Number(item.avg_sales_30d).toFixed(2)} unit/hr`}
              </p>
            </div>
            <div>
              <span className="text-xs text-slate-400">Estimasi Habis</span>
              <p>
                {item.estimasi_hari_habis == null
                  ? "Belum terjual 30h"
                  : `${item.estimasi_hari_habis} hari`}
              </p>
            </div>
            <div>
              <span className="text-xs text-slate-400">ROP (Batas Pesan Ulang)</span>
              <p>
                {Number(item.avg_sales_30d || 0) === 0
                  ? "Belum ada data"
                  : `${angka(item.rop)} unit`}
              </p>
            </div>
            <div className="col-span-2">
              <span className="text-xs text-slate-400">
                Status ROP{Number(item.avg_sales_30d || 0) > 0 && ` — lead time ${item.lead_time_hari}h, safety stock ${angka(item.safety_stock)} unit`}
              </span>
              <p className={`font-semibold ${Number(item.avg_sales_30d || 0) === 0 ? "text-slate-400" : item.dibawah_rop ? "text-red-600" : "text-emerald-600"}`}>
                {Number(item.avg_sales_30d || 0) === 0
                  ? "Belum ada data penjualan"
                  : item.dibawah_rop
                  ? "Di Bawah ROP — Pesan Sekarang!"
                  : "Aman (Di Atas ROP)"}
              </p>
            </div>
          </div>
        </div>

        {viewOnly ? (
          <div className="flex justify-end border-t border-slate-100 pt-3">
            <Button variant="secondary" size="sm" onClick={close}>Tutup</Button>
          </div>
        ) : (
          <div className="border-t border-slate-100 pt-3 space-y-3">
            <h4 className="text-sm font-semibold text-slate-700">Ubah Min. Stok</h4>
            <Input
              label="Min Stok Baru"
              type="number"
              min="0"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            <Input
              label={
                <>
                  Alasan Perubahan <span className="text-red-500">*</span>
                </>
              }
              type="text"
              placeholder="Alasan perubahan min. stok..."
              value={alasan}
              onChange={(e) => setAlasan(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={close}>
                Batal
              </Button>
              <Button
                size="sm"
                onClick={() => save.mutate()}
                disabled={save.isPending || !alasan.trim()}
              >
                {save.isPending ? "saving..." : "Save"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
