"use client";
// Modal read-only detail barang.

import { Modal, Button, Badge } from "@/components/ui";
import { rupiah, angka } from "@/lib/format";

function stokBadge(p) {
  if (Number(p.stok) === 0) return <Badge tone="red">Stok Habis</Badge>;
  if (Number(p.stok) <= Number(p.min_stock)) return <Badge tone="amber">Stok Menipis</Badge>;
  return <Badge tone="green">Normal</Badge>;
}

function InfoRow({ label, children }) {
  return (
    <div>
      <span className="block text-xs text-slate-400">{label}</span>
      <div className="mt-0.5 text-sm font-medium text-slate-800">{children}</div>
    </div>
  );
}

export function ProductViewModal({ open, onClose, product }) {
  if (!product) return null;

  return (
    <Modal open={open} onClose={onClose} title="Detail Barang">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 rounded-lg bg-slate-50 p-3">
          <InfoRow label="Kode Barang">
            <span className="font-mono">{product.kode_barang}</span>
          </InfoRow>
          <InfoRow label="Nama Barang">{product.nama_barang}</InfoRow>
          <InfoRow label="Merk">{product.merk || "-"}</InfoRow>
          <InfoRow label="Kondisi Stok">{stokBadge(product)}</InfoRow>
          <InfoRow label="Harga Beli">{rupiah(product.harga_beli)}</InfoRow>
          <InfoRow label="Harga Jual">{rupiah(product.harga_jual)}</InfoRow>
          <InfoRow label="Stok Sekarang">
            <span className="text-lg">{angka(product.stok)}</span>
          </InfoRow>
          <InfoRow label="Min Stok">
            <span className="text-lg">{angka(product.min_stock)}</span>
          </InfoRow>
          {product.status === "nonaktif" && (
            <div className="col-span-2">
              <InfoRow label="Status Barang">
                <Badge tone="slate">nonaktif</Badge>
              </InfoRow>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>Tutup</Button>
        </div>
      </div>
    </Modal>
  );
}
