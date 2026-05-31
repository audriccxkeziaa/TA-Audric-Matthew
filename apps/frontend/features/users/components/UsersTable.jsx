"use client";
import { Card, Badge, Skeleton, EmptyState, Table, THead, TH, TBody, TR, TD } from "@/components/ui";
import { Eye, Pencil, Trash2, Power } from "lucide-react";

function fmtWita(iso) {
  if (!iso) return "-";
  try {
    return new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Makassar",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return "-";
  }
}

function RoleBadge({ role }) {
  if (role === "superadmin") {
    return <Badge className="bg-purple-100 text-purple-700">Admin</Badge>;
  }
  return <Badge className="bg-blue-100 text-blue-700">Kasir</Badge>;
}

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
  const sortedUsers = [...users].sort((a, b) => {
    if (a.role === "superadmin" && b.role !== "superadmin") return -1;
    if (a.role !== "superadmin" && b.role === "superadmin") return 1;
    return 0;
  });

  return (
    <Card className="flex min-h-0 flex-1 flex-col p-0">
      {isLoading ? (
        <div className="p-4"><Skeleton rows={5} /></div>
      ) : sortedUsers.length === 0 ? (
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
              <TH>Terakhir Login</TH>
              <TH className="text-right">Total Transaksi</TH>
              <TH className="text-center">Aksi</TH>
            </THead>
            <TBody>
              {sortedUsers.map((u) => {
                const isSelf = u.id === currentUserId;
                const active = u.is_active !== false;
                const isAdmin = u.role === "superadmin";
                return (
                  <TR key={u.id}>
                    <TD className="font-medium">
                      {u.username}
                      {isSelf && <span className="ml-1 text-xs text-slate-400">(Anda)</span>}
                    </TD>
                    <TD className="text-slate-600">{u.nama_lengkap || "-"}</TD>
                    <TD className="text-slate-500">{u.no_telepon || "-"}</TD>
                    <TD><RoleBadge role={u.role} /></TD>
                    <TD>
                      <Badge tone={active ? "green" : "red"}>{active ? "Aktif" : "Nonaktif"}</Badge>
                    </TD>
                    <TD className="text-slate-500 text-xs">{fmtWita(u.last_sign_in_at || u.updated_at)}</TD>
                    <TD className="text-right text-slate-700">{u.total_transaksi ?? 0}</TD>
                    <TD>
                      <div className="flex items-center justify-center gap-0.5">
                        {!isAdmin && (
                          <ActionBtn onClick={() => onView(u)} title="Lihat detail" colorClass="text-blue-600 hover:text-blue-800">
                            <Eye className="h-4 w-4" />
                          </ActionBtn>
                        )}
                        <ActionBtn onClick={() => onEdit(u)} title="Edit user" colorClass="text-amber-500 hover:text-amber-700">
                          <Pencil className="h-4 w-4" />
                        </ActionBtn>
                        {!isSelf && (
                          <>
                            <ActionBtn
                              onClick={() => onToggle(u)}
                              title={active ? "Deactivate user" : "Activate user"}
                              colorClass="text-gray-500 hover:text-gray-700"
                            >
                              <Power className="h-4 w-4" />
                            </ActionBtn>
                            <ActionBtn onClick={() => onDelete(u)} title="Hapus user" colorClass="text-red-600 hover:text-red-800">
                              <Trash2 className="h-4 w-4" />
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
            {sortedUsers.map((u) => {
              const isSelf = u.id === currentUserId;
              const active = u.is_active !== false;
              const isAdmin = u.role === "superadmin";
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
                      <RoleBadge role={u.role} />
                      <Badge tone={active ? "green" : "red"}>{active ? "Aktif" : "Nonaktif"}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      Login {fmtWita(u.last_sign_in_at || u.updated_at)} · {u.total_transaksi ?? 0} transaksi
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    {!isAdmin && (
                      <ActionBtn onClick={() => onView(u)} title="Lihat detail" colorClass="text-blue-600 hover:text-blue-800">
                        <Eye className="h-4 w-4" />
                      </ActionBtn>
                    )}
                    <ActionBtn onClick={() => onEdit(u)} title="Edit user" colorClass="text-amber-500 hover:text-amber-700">
                      <Pencil className="h-4 w-4" />
                    </ActionBtn>
                    {!isSelf && (
                      <>
                        <ActionBtn
                          onClick={() => onToggle(u)}
                          title={active ? "Deactivate" : "Activate"}
                          colorClass="text-gray-500 hover:text-gray-700"
                        >
                          <Power className="h-4 w-4" />
                        </ActionBtn>
                        <ActionBtn onClick={() => onDelete(u)} title="Hapus user" colorClass="text-red-600 hover:text-red-800">
                          <Trash2 className="h-4 w-4" />
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
