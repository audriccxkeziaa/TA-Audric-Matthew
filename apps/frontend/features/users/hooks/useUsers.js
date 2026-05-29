"use client";
// features/users/hooks/useUsers.js — daftar user + kontrol modal (tambah / detail).

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usersApi } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

export function useUsers() {
  const { user } = useAuth();
  const [showAdd, setShowAdd] = useState(false);
  const [viewTarget, setViewTarget] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: usersApi.list,
  });

  return {
    currentUser: user,
    users: data?.data || [],
    isLoading,
    showAdd,
    setShowAdd,
    viewTarget,
    setViewTarget,
  };
}
