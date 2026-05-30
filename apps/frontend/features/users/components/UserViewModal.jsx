"use client";
// Modal read-only detail user. Informasi "Terakhir Diubah" tampil di sini.

import { Modal, Button, Badge } from "@/components/ui";
import { tanggal, tanggalJam } from "@/lib/format";

function InfoRow({ label, children }) {
  return (
    <div>
      <span className="block text-xs text-slate-400">{label}</span>
      <div className="mt-0.5 text-sm font-medium text-slate-800">{children}</div>
    </div>
  );
}

export function UserViewModal({ open, onClose, target }) {
  if (!target) return null;
  const active = target.is_active !== false;

  return (
    <Modal open={open} onClose={onClose} title={`Detail User — ${target.username}`}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 rounded-lg bg-slate-50 p-3">
          <InfoRow label="Username">{target.username}</InfoRow>
          <InfoRow label="Role">
            <Badge tone={target.role === "superadmin" ? "indigo" : "slate"}>{target.role}</Badge>
          </InfoRow>
          <InfoRow label="Nama Lengkap">{target.nama_lengkap || "-"}</InfoRow>
          <InfoRow label="No Telepon">{target.no_telepon || "-"}</InfoRow>
          <InfoRow label="Status">
            <Badge tone={active ? "green" : "red"}>{active ? "Aktif" : "Nonaktif"}</Badge>
          </InfoRow>
          <InfoRow label="Total Transaksi Sukses">
            {target.total_transaksi ?? 0} transaksi
          </InfoRow>
          <InfoRow label="Tanggal Bergabung">{tanggal(target.created_at)}</InfoRow>
          <InfoRow label="Terakhir Diubah">{tanggalJam(target.updated_at)}</InfoRow>
        </div>

        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>Tutup</Button>
        </div>
      </div>
    </Modal>
  );
}
