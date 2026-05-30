"use client";
// Tabel daftar user dengan 4 tombol aksi: View, Edit, Delete, Deactivate.

import { Card, Badge, Skeleton, EmptyState, Table, THead, TH, TBody, TR, TD } from "@/components/ui";
import { tanggal } from "@/lib/format";
import { EyeIcon, PencilIcon, TrashIcon, PowerOffIcon } from "./icons";

function ActionBtn({ onClick, title, colorClass, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`inline-flex items-center justify-center rounded p-1.5 transition hover:bg-slate-100 ${colorClass}`}
    >
      {children}
    </button>
  );
}

export function UsersTable({ users, isLoading, currentUserId, onView, onEdit, onDelete, onToggle }) {
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
              <TH>Nama Lengkap</TH>
              <TH>No Telepon</TH>
              <TH>Role</TH>
              <TH>Status</TH>
              <TH>Tgl Bergabung</TH>
              <TH className="text-right">Total Transaksi</TH>
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
                    <TD className="text-slate-600">{u.nama_lengkap || "-"}</TD>
                    <TD className="text-slate-500">{u.no_telepon || "-"}</TD>
                    <TD>
                      <Badge tone={u.role === "superadmin" ? "indigo" : "slate"}>{u.role}</Badge>
                    </TD>
                    <TD>
                      <Badge tone={active ? "green" : "red"}>{active ? "Aktif" : "Nonaktif"}</Badge>
                    </TD>
                    <TD className="text-slate-500">{tanggal(u.created_at)}</TD>
                    <TD className="text-right text-slate-700">{u.total_transaksi ?? 0}</TD>
                    <TD>
                      <div className="flex items-center justify-center gap-0.5">
                        <ActionBtn onClick={() => onView(u)} title="Lihat detail" colorClass="text-slate-500 hover:text-brand-600">
                          <EyeIcon />
                        </ActionBtn>
                        <ActionBtn onClick={() => onEdit(u)} title="Edit user" colorClass="text-slate-500 hover:text-blue-600">
                          <PencilIcon />
                        </ActionBtn>
                        {!isSelf && (
                          <>
                            <ActionBtn
                              onClick={() => onToggle(u)}
                              title={active ? "Deactivate user" : "Activate user"}
                              colorClass={active ? "text-amber-500 hover:text-amber-700" : "text-emerald-500 hover:text-emerald-700"}
                            >
                              <PowerOffIcon />
                            </ActionBtn>
                            <ActionBtn onClick={() => onDelete(u)} title="Hapus user" colorClass="text-slate-400 hover:text-red-600">
                              <TrashIcon />
                            </ActionBtn>
                          </>
                        )}
                      </div>
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
                    {u.nama_lengkap && (
                      <p className="text-sm text-slate-600">{u.nama_lengkap}</p>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge tone={u.role === "superadmin" ? "indigo" : "slate"}>{u.role}</Badge>
                      <Badge tone={active ? "green" : "red"}>{active ? "Aktif" : "Nonaktif"}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      Bergabung {tanggal(u.created_at)} · {u.total_transaksi ?? 0} transaksi
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <ActionBtn onClick={() => onView(u)} title="Lihat detail" colorClass="text-slate-500 hover:text-brand-600">
                      <EyeIcon />
                    </ActionBtn>
                    <ActionBtn onClick={() => onEdit(u)} title="Edit user" colorClass="text-slate-500 hover:text-blue-600">
                      <PencilIcon />
                    </ActionBtn>
                    {!isSelf && (
                      <>
                        <ActionBtn
                          onClick={() => onToggle(u)}
                          title={active ? "Deactivate" : "Activate"}
                          colorClass={active ? "text-amber-500 hover:text-amber-700" : "text-emerald-500 hover:text-emerald-700"}
                        >
                          <PowerOffIcon />
                        </ActionBtn>
                        <ActionBtn onClick={() => onDelete(u)} title="Hapus user" colorClass="text-slate-400 hover:text-red-600">
                          <TrashIcon />
                        </ActionBtn>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Card>
  );
}
