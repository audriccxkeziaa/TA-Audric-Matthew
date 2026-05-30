"use client";
// /users — Manajemen User (admin only). Orkestrator UI.

import { PageShell, PageHeader, Button } from "@/components/ui";
import { useUsers } from "../hooks/useUsers";
import { UsersTable } from "./UsersTable";
import { AddUserModal } from "./AddUserModal";
import { UserViewModal } from "./UserViewModal";
import { UserDetailModal } from "./UserDetailModal";

export default function UsersPage() {
  const u = useUsers();

  return (
    <PageShell>
      <PageHeader
        title="Manajemen User"
        description="Halaman untuk mengelola role superadmin dan kasir."
        actions={<Button onClick={() => u.setShowAdd(true)}>+ Add User</Button>}
      />

      <UsersTable
        users={u.users}
        isLoading={u.isLoading}
        currentUserId={u.currentUser?.id}
        onView={u.setViewTarget}
        onEdit={u.setEditTarget}
        onDelete={u.handleDelete}
        onToggle={u.handleToggle}
      />

      {u.showAdd && (
        <AddUserModal open={u.showAdd} onClose={() => u.setShowAdd(false)} />
      )}

      {u.viewTarget && (
        <UserViewModal
          open={Boolean(u.viewTarget)}
          onClose={() => u.setViewTarget(null)}
          target={u.viewTarget}
        />
      )}

      {u.editTarget && (
        <UserDetailModal
          open={Boolean(u.editTarget)}
          onClose={() => u.setEditTarget(null)}
          target={u.editTarget}
          isSelf={u.editTarget?.id === u.currentUser?.id}
        />
      )}
    </PageShell>
  );
}
