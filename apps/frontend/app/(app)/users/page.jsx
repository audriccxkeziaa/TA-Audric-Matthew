"use client";
// =================================================================
// /users — Manajemen User (admin only)
// =================================================================

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usersApi } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { tanggal, tanggalJam } from "@/lib/format";
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

function EyeIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

function EyeOpenIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

function EyeSlashIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
    </svg>
  );
}

function PasswordInput({ label, value, onChange }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        label={label}
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
      />
      <button
        type="button"
        onClick={() => setShow((p) => !p)}
        className="absolute right-3 top-[34px] text-slate-400 hover:text-slate-600"
        tabIndex={-1}
      >
        {show ? <EyeOpenIcon /> : <EyeSlashIcon />}
      </button>
    </div>
  );
}

// ---------- Modal detail / edit user ----------
function UserDetailModal({ open, onClose, target, isSelf }) {
  const qc = useQueryClient();
  const toast = useToast();

  const [form, setForm] = useState(() => ({
    username: target?.username || "",
    password: "",
    role: target?.role || "kasir",
  }));
  const [err, setErr] = useState("");

  function set(f, v) {
    setForm((s) => ({ ...s, [f]: v }));
  }

  const active = target?.is_active !== false;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.username.trim()) throw new Error("Username wajib diisi");
      const body = { username: form.username.trim(), role: form.role };
      if (form.password) {
        if (form.password.length < 6) throw new Error("Password minimal 6 karakter");
        body.password = form.password;
      }
      return usersApi.update(target.id, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success("User berhasil diperbarui.");
      onClose();
    },
    onError: (e) => setErr(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: () => usersApi.setStatus(target.id, !active),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success(active ? "User berhasil dinonaktifkan." : "User berhasil diaktifkan.");
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

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
              onClick={() => toggleMutation.mutate()}
              disabled={toggleMutation.isPending}
            >
              {toggleMutation.isPending
                ? "Memproses..."
                : active
                ? "Nonaktifkan User"
                : "Aktifkan User"}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() => { setErr(""); saveMutation.mutate(); }}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ---------- Form tambah user baru ----------
function AddUserForm({ open, onClose }) {
  const qc = useQueryClient();
  const toast = useToast();

  const [form, setForm] = useState({ username: "", password: "", role: "kasir" });
  const [err, setErr] = useState("");

  function set(f, v) {
    setForm((s) => ({ ...s, [f]: v }));
  }

  const mutation = useMutation({
    mutationFn: async () => {
      if (!form.username.trim()) throw new Error("Username wajib diisi");
      if (!form.password) throw new Error("Password wajib diisi");
      if (form.password.length < 6) throw new Error("Password minimal 6 karakter");
      return usersApi.create({
        username: form.username.trim(),
        password: form.password,
        role: form.role,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success("User ditambahkan");
      onClose();
    },
    onError: (e) => setErr(e.message),
  });

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
          <Button onClick={() => { setErr(""); mutation.mutate(); }} disabled={mutation.isPending}>
            {mutation.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default function UsersPage() {
  const { user } = useAuth();
  const [showAdd, setShowAdd] = useState(false);
  const [viewTarget, setViewTarget] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: usersApi.list,
  });
  const users = data?.data || [];

  return (
    <PageShell>
      <PageHeader
        title="Manajemen User"
        description="Halaman untuk mengelola role superadmin dan kasir."
        actions={
          <Button onClick={() => setShowAdd(true)}>+ Add User</Button>
        }
      />

      <Card className="flex min-h-0 flex-1 flex-col p-0">
        {isLoading ? (
          <div className="p-4"><Skeleton rows={5} /></div>
        ) : users.length === 0 ? (
          <EmptyState title="Belum ada user" />
        ) : (
          <div className="min-h-0 flex-1 overflow-auto thin-scroll">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Username</th>
                  <th className="px-4 py-2.5">Role</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Dibuat</th>
                  <th className="px-4 py-2.5">Terakhir Diubah</th>
                  <th className="px-4 py-2.5 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => {
                  const isSelf = u.id === user?.id;
                  const active = u.is_active !== false;
                  return (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-medium">
                        {u.username}
                        {isSelf && <span className="ml-1 text-xs text-slate-400">(Anda)</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge tone={u.role === "superadmin" ? "indigo" : "slate"}>{u.role}</Badge>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge tone={active ? "green" : "red"}>{active ? "Aktif" : "Nonaktif"}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">{tanggal(u.created_at)}</td>
                      <td className="px-4 py-2.5 text-slate-500">{tanggalJam(u.updated_at)}</td>
                      <td className="px-4 py-2.5 text-center">
                        <button
                          onClick={() => setViewTarget(u)}
                          className="inline-flex items-center justify-center rounded p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-brand-600"
                          title="Lihat / Edit user"
                        >
                          <EyeIcon />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showAdd && <AddUserForm open={showAdd} onClose={() => setShowAdd(false)} />}

      {viewTarget && (
        <UserDetailModal
          open={Boolean(viewTarget)}
          onClose={() => setViewTarget(null)}
          target={viewTarget}
          isSelf={viewTarget?.id === user?.id}
        />
      )}
    </PageShell>
  );
}
