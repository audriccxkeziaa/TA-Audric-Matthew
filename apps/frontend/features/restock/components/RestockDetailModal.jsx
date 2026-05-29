"use client";
// Modal detail produk + ubah min. stok (admin). Alasan wajib (audit trail).
// State & mutation di hook useRestockDetail; init value dari item.min_stock
// dipertahankan apa adanya (via setTimeout saat pertama render).

import { Modal, Button } from "@/components/ui";
import { angka } from "@/lib/format";
import { UrgensiBadge } from "./UrgensiBadge";
import { useRestockDetail } from "../hooks/useRestockDetail";

export function RestockDetailModal({ item, onClose }) {
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
      title="Detail Produk & Ubah Min. Stok"
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
          </div>
        </div>

        <div className="border-t border-slate-100 pt-3 space-y-3">
          <h4 className="text-sm font-semibold text-slate-700">Ubah Min. Stok</h4>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Min Stok Baru</label>
            <input
              type="number"
              min="0"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Alasan Perubahan <span className="text-red-500">*</span></label>
            <input
              type="text"
              placeholder="Alasan perubahan min. stok..."
              value={alasan}
              onChange={(e) => setAlasan(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500 placeholder:text-slate-400"
            />
          </div>
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
      </div>
    </Modal>
  );
}
