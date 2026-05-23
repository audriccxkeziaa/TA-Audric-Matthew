"use client";
// =================================================================
// /users — Manajemen User (admin only)
// =================================================================
// CRUD user + aktif/nonaktif. Admin tidak boleh menonaktifkan atau
// menurunkan role akunnya sendiri (dijaga backend & UI).
// =================================================================

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usersApi } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { tanggal } from "@/lib/format";
import {
  PageShell,
  PageHeader,
  Card,
  Button,
  Input,
  Select,
  Badge,
  Modal,
  ConfirmDialog,
  Skeleton,
  EmptyState,
} from "@/components/ui";

// ---------- Form tambah / edit user ----------
function UserForm({ open, onClose, editing }) {
  const qc = useQueryClient();
  const toast = useToast();
  const isEdit = Boolean(editing);

  const [form, setForm] = useState(() => ({
    username: editing?.username || "",
    email: editing?.email || "",
    password: "",
    role: editing?.role || "kasir",
  }));
  const [err, setErr] = useState("");

  function set(f, v) {
    setForm((s) => ({ ...s, [f]: v }));
  }

  const mutation = useMutation({
    mutationFn: async () => {
      if (!form.username.trim()) throw new Error("Username wajib diisi");
      if (!isEdit) {
        if (!form.email.trim() || !form.password)
          throw new Error("Email dan password wajib diisi");
        if (form.password.length < 6)
          throw new Error("Password minimal 6 karakter");
        return usersApi.create({
          username: form.username.trim(),
          email: form.email.trim(),
          password: form.password,
          role: form.role,
        });
      }
      // Edit — kirim hanya field yang relevan.
      const body = { username: form.username.trim(), role: form.role };
      if (form.email.trim()) body.email = form.email.trim();
      if (form.password) {
        if (form.password.length < 6)
          throw new Error("Password minimal 6 karakter");
        body.password = form.password;
      }
      return usersApi.update(editing.id, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success(isEdit ? "User diperbarui" : "User ditambahkan");
      onClose();
    },
    onError: (e) => setErr(e.message),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit User" : "Tambah User Baru"}
    >
      <div className="space-y-3">
        <Input
          label="Username"
          value={form.username}
          onChange={(e) => set("username", e.target.value)}
        />
        <Input
          label="Email"
          type="email"
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
        />
        <Input
          label={
            isEdit
              ? "Password baru (kosongkan jika tidak diubah)"
              : "Password"
          }
          type="password"
          value={form.password}
          onChange={(e) => set("password", e.target.value)}
        />
        <Select
          label="Role"
          value={form.role}
          onChange={(e) => set("role", e.target.value)}
        >
          <option value="kasir">Kasir</option>
          <option value="admin">Admin</option>
        </Select>

        {err && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {err}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button
            onClick={() => {
              setErr("");
              mutation.mutate();
            }}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Menyimpan..." : "Simpan"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default function UsersPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null); // { user, nextActive }

  const { data, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: usersApi.list,
  });
  const users = data?.data || [];

  const toggleStatus = useMutation({
    mutationFn: ({ id, is_active }) => usersApi.setStatus(id, is_active),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success(
        vars.is_active ? "User diaktifkan" : "User dinonaktifkan"
      );
      setConfirm(null);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <PageShell>
      <PageHeader
        title="Manajemen User"
        description="Kelola akun admin dan kasir."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
          >
            + Tambah User
          </Button>
        }
      />

      <Card className="flex min-h-0 flex-1 flex-col p-0">
        {isLoading ? (
          <div className="p-4">
            <Skeleton rows={5} />
          </div>
        ) : users.length === 0 ? (
          <EmptyState title="Belum ada user" />
        ) : (
          <div className="min-h-0 flex-1 overflow-auto thin-scroll">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Username</th>
                  <th className="px-4 py-2.5">Email</th>
                  <th className="px-4 py-2.5">Role</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Dibuat</th>
                  <th className="px-4 py-2.5 text-right">Aksi</th>
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
                        {isSelf && (
                          <span className="ml-1 text-xs text-slate-400">
                            (Anda)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">
                        {u.email || "-"}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge tone={u.role === "admin" ? "indigo" : "slate"}>
                          {u.role}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge tone={active ? "green" : "red"}>
                          {active ? "Aktif" : "Nonaktif"}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">
                        {tanggal(u.created_at)}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditing(u);
                              setShowForm(true);
                            }}
                          >
                            Edit
                          </Button>
                          {/* Admin tidak boleh nonaktifkan dirinya sendiri */}
                          {!isSelf && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className={
                                active
                                  ? "text-red-600 hover:bg-red-50"
                                  : "text-emerald-600 hover:bg-emerald-50"
                              }
                              onClick={() =>
                                setConfirm({ user: u, nextActive: !active })
                              }
                            >
                              {active ? "Nonaktifkan" : "Aktifkan"}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showForm && (
        <UserForm
          open={showForm}
          editing={editing}
          onClose={() => setShowForm(false)}
        />
      )}

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={() =>
          toggleStatus.mutate({
            id: confirm.user.id,
            is_active: confirm.nextActive,
          })
        }
        title={confirm?.nextActive ? "Aktifkan User" : "Nonaktifkan User"}
        message={
          confirm?.nextActive
            ? `Aktifkan kembali akun "${confirm?.user.username}"?`
            : `Nonaktifkan akun "${confirm?.user.username}"? User tidak akan bisa login.`
        }
        confirmLabel="Ya, lanjutkan"
        tone={confirm?.nextActive ? "success" : "danger"}
      />
    </PageShell>
  );
}
