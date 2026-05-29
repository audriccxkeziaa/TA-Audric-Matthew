"use client";
// Modal detail / edit user — murni UI. State & mutation di hook useUserDetail.

import { Modal, Button, Input, Select, Badge } from "@/components/ui";
import { tanggalJam } from "@/lib/format";
import { PasswordInput } from "./PasswordInput";
import { useUserDetail } from "../hooks/useUserDetail";

export function UserDetailModal({ open, onClose, target, isSelf }) {
  const { form, set, err, active, save, saving, toggle, toggling } =
    useUserDetail({ target, onClose });

  return (
    <Modal open={open} onClose={onClose} title={`Detail User — ${target?.username}`}>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Status:</span>
            <Badge tone={active ? "green" : "red"}>{active ? "Aktif" : "Nonaktif"}</Badge>
          </div>
          {target?.updated_at && (
            <span className="text-xs text-slate-400">
              Terakhir diubah: {tanggalJam(target.updated_at)}
            </span>
          )}
        </div>

        <Input
          label="Username"
          value={form.username}
          onChange={(e) => set("username", e.target.value)}
        />
        <PasswordInput
          label="Password baru (kosongkan jika tidak diubah)"
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
          <option value="superadmin">Superadmin</option>
        </Select>

        {err && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
          {!isSelf ? (
            <Button
              variant="ghost"
              className={active ? "text-red-600 hover:bg-red-50" : "text-emerald-600 hover:bg-emerald-50"}
              onClick={toggle}
              disabled={toggling}
            >
              {toggling
                ? "Processing..."
                : active
                ? "Deactivate User"
                : "Activate User"}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
