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
          {/* ===== Tampilan DESKTOP (md+) ===== */}
          <table className="hidden w-full text-sm md:table">
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

          {/* ===== Tampilan HP (< md) — kartu per user ===== */}
          <ul className="divide-y divide-slate-100 md:hidden">
            {users.map((u) => {
              const isSelf = u.id === currentUserId;
              const active = u.is_active !== false;
              return (
                <li key={u.id} className="flex items-start justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800">
                      {u.username}
                      {isSelf && <span className="ml-1 text-xs text-slate-400">(Anda)</span>}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge tone={u.role === "superadmin" ? "indigo" : "slate"}>{u.role}</Badge>
                      <Badge tone={active ? "green" : "red"}>{active ? "Aktif" : "Nonaktif"}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      Dibuat {tanggal(u.created_at)} · Diubah {tanggalJam(u.updated_at)}
                    </p>
                  </div>
                  <button
                    onClick={() => onView(u)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-brand-600"
                    title="Lihat / Edit user"
                    aria-label="Lihat / Edit user"
                  >
                    <EyeIcon />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Card>
  );
}
