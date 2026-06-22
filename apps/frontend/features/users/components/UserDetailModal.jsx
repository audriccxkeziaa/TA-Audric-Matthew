"use client";
// Modal edit user — murni edit. Toggle status & delete ada di tombol tabel langsung.

import { Modal, Button, Input, Select, Badge } from "@/components/ui";
import { PasswordInput } from "./PasswordInput";
import { useUserDetail } from "../hooks/useUserDetail";

export function UserDetailModal({ open, onClose, target, isSelf }) {
  const { form, set, err, save, saving } = useUserDetail({ target, onClose });
  const active = target?.is_active !== false;

  return (
    <Modal open={open} onClose={onClose} title={`Edit User — ${target?.username}`}>
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
          <span className="text-sm text-slate-500">Status saat ini:</span>
          <Badge tone={active ? "green" : "red"}>{active ? "Aktif" : "Nonaktif"}</Badge>
        </div>

        <Input
          label="Username"
          value={form.username}
          onChange={(e) => set("username", e.target.value)}
        />
        <Input
          label="Nama Lengkap"
          value={form.nama_lengkap}
          onChange={(e) => set("nama_lengkap", e.target.value)}
          placeholder="Nama lengkap (opsional)"
        />
        <Input
          label="No Telepon"
          value={form.no_telepon}
          onChange={(e) => set("no_telepon", e.target.value)}
          placeholder="Nomor telepon (opsional)"
        />
        <PasswordInput
          label="Set Password Baru (Opsional)"
          value={form.password}
          onChange={(e) => set("password", e.target.value)}
        />
        <Select
          label="Role"
          value={form.role}
          onChange={(e) => set("role", e.target.value)}
          disabled={isSelf}
        >
          <option value="kasir">Kasir</option>
          <option value="admin">Admin</option>
        </Select>

        {err && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
