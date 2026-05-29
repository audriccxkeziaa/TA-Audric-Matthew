"use client";
// /users — Manajemen User (admin only). Orkestrator UI.

import { PageShell, PageHeader, Button } from "@/components/ui";
import { useUsers } from "../hooks/useUsers";
import { UsersTable } from "./UsersTable";
import { AddUserModal } from "./AddUserModal";
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
      />

      {u.showAdd && (
        <AddUserModal open={u.showAdd} onClose={() => u.setShowAdd(false)} />
      )}

      {u.viewTarget && (
        <UserDetailModal
          open={Boolean(u.viewTarget)}
          onClose={() => u.setViewTarget(null)}
          target={u.viewTarget}
          isSelf={u.viewTarget?.id === u.currentUser?.id}
        />
      )}
    </PageShell>
  );
}
