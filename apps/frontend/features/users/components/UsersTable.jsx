"use client";
// Tabel daftar user. Tombol mata membuka modal detail/edit.

import { Card, Badge, Skeleton, EmptyState, Table, THead, TH, TBody, TR, TD } from "@/components/ui";
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
          <Table>
            <THead>
              <TH>Username</TH>
              <TH>Role</TH>
              <TH>Status</TH>
              <TH>Dibuat</TH>
              <TH>Terakhir Diubah</TH>
              <TH className="text-center">Aksi</TH>
            </THead>
            <TBody>
              {users.map((u) => {
                const isSelf = u.id === currentUserId;
                const active = u.is_active !== false;
                return (
                  <TR key={u.id}>
                    <TD className="font-medium">
                      {u.username}
                      {isSelf && <span className="ml-1 text-xs text-slate-400">(Anda)</span>}
                    </TD>
                    <TD>
                      <Badge tone={u.role === "superadmin" ? "indigo" : "slate"}>{u.role}</Badge>
                    </TD>
                    <TD>
                      <Badge tone={active ? "green" : "red"}>{active ? "Aktif" : "Nonaktif"}</Badge>
                    </TD>
                    <TD className="text-slate-500">{tanggal(u.created_at)}</TD>
                    <TD className="text-slate-500">{tanggalJam(u.updated_at)}</TD>
                    <TD className="text-center">
                      <button
                        onClick={() => onView(u)}
                        className="inline-flex items-center justify-center rounded p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-brand-600"
                        title="Lihat / Edit user"
                      >
                        <EyeIcon />
                      </button>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>

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
