"use client";
// features/users/hooks/useUserDetail.js — state form + mutation simpan & toggle
// status (aktif/nonaktif) untuk modal detail user. Validasi dipindah apa adanya.

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usersApi } from "@/lib/api";
import { useToast } from "@/hooks/useToast";

export function useUserDetail({ target, onClose }) {
  const qc = useQueryClient();
  const toast = useToast();

  const [form, setForm] = useState(() => ({
    username: target?.username || "",
    password: "",
    role: target?.role || "kasir",
  }));
  const [err, setErr] = useState("");

  function set(f, v) {
    setForm((s) => ({ ...s, [f]: v }));
  }

  const active = target?.is_active !== false;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.username.trim()) throw new Error("Username wajib diisi");
      const body = { username: form.username.trim(), role: form.role };
      if (form.password) {
        if (form.password.length < 6)
          throw new Error("Password minimal 6 karakter");
        body.password = form.password;
      }
      return usersApi.update(target.id, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success("User berhasil diperbarui.");
      onClose();
    },
    onError: (e) => setErr(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: () => usersApi.setStatus(target.id, !active),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success(
        active ? "User berhasil dinonaktifkan." : "User berhasil diaktifkan."
      );
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  function save() {
    setErr("");
    saveMutation.mutate();
  }

  return {
    form,
    set,
    err,
    active,
    save,
    saving: saveMutation.isPending,
    toggle: () => toggleMutation.mutate(),
    toggling: toggleMutation.isPending,
  };
}
