"use client";
// features/users/hooks/useUsers.js — daftar user + kontrol modal (tambah / view / edit)
// + inline delete & toggle-status langsung dari tabel.

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usersApi } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";

export function useUsers() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();

  const [showAdd, setShowAdd] = useState(false);
  const [viewTarget, setViewTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);

  // Kolom "Terakhir Login" harus segar tanpa refresh manual. Realtime
  // (useRealtimeSync) membuatnya instan saat event UPDATE tabel users tiba;
  // namun event itu bisa tidak terkirim ke admin (mis. keterbatasan RLS pada
  // realtime untuk baris user lain). Karena itu ditambahkan polling ringan tiap
  // 15 detik + refetch saat tab kembali fokus sebagai cadangan yang andal.
  const { data, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: usersApi.list,
    staleTime: 0,
    refetchInterval: 15000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => usersApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success("User berhasil dihapus");
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }) => usersApi.setStatus(id, is_active),
    onSuccess: (_, { is_active }) => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success(is_active ? "User berhasil diaktifkan" : "User berhasil dinonaktifkan");
    },
    onError: (e) => toast.error(e.message),
  });

  function handleDelete(u) {
    if (!window.confirm(`Hapus user "${u.username}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    deleteMutation.mutate(u.id);
  }

  function handleToggle(u) {
    const next = !u.is_active;
    const action = next ? "mengaktifkan" : "menonaktifkan";
    if (!window.confirm(`Yakin ${action} user "${u.username}"?`)) return;
    toggleMutation.mutate({ id: u.id, is_active: next });
  }

  return {
    currentUser: user,
    users: data?.data || [],
    isLoading,
    showAdd,
    setShowAdd,
    viewTarget,
    setViewTarget,
    editTarget,
    setEditTarget,
    handleDelete,
    handleToggle,
  };
}
