"use client";
// Tabel daftar user. Tombol mata membuka modal detail/edit.

import { Card, Badge, Skeleton, EmptyState } from "@/components/ui";
import { tanggal, tanggalJam } from "@/lib/format";
import { EyeIcon } from "./icons";

export function UsersTable({ users, isLoading, currentUserId, onView }) {
  return (
    <Card className="flex min-h-0 flex-1 flex-col p-0">
      {isLoading ? (
        <div className="p-4"><Skeleton rows={5} /></div>
      ) : users.length === 0 ? (
        <EmptyState title="Belum ada user" />
      ) : (
        <div className="min-h-0 flex-1 overflow-auto thin-scroll">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
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
                const isSelf = u.id === currentUserId;
                const active = u.is_active !== false;
                return (
                  <tr key={u.id} className="transition-colors hover:bg-brand-50/40">
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
                        onClick={() => onView(u)}
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
  );
}
