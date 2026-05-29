"use client";
// Modal tambah user baru — murni UI. State & mutation di hook useAddUser.

import { Modal, Button, Input, Select } from "@/components/ui";
import { PasswordInput } from "./PasswordInput";
import { useAddUser } from "../hooks/useAddUser";

export function AddUserModal({ open, onClose }) {
  const { form, set, err, submit, saving } = useAddUser({ onClose });

  return (
    <Modal open={open} onClose={onClose} title="Tambah User Baru">
      <div className="space-y-3">
        <Input label="Username" value={form.username} onChange={(e) => set("username", e.target.value)} />
        <PasswordInput label="Password" value={form.password} onChange={(e) => set("password", e.target.value)} />
        <Select label="Role" value={form.role} onChange={(e) => set("role", e.target.value)}>
          <option value="kasir">Kasir</option>
          <option value="superadmin">Superadmin</option>
        </Select>

        {err && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
