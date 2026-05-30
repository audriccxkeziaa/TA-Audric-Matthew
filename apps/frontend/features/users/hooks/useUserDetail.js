"use client";
// features/users/hooks/useUserDetail.js — state form + mutation simpan user (edit only).

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
    nama_lengkap: target?.nama_lengkap || "",
    no_telepon: target?.no_telepon || "",
  }));
  const [err, setErr] = useState("");

  function set(f, v) {
    setForm((s) => ({ ...s, [f]: v }));
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.username.trim()) throw new Error("Username wajib diisi");
      const body = {
        username: form.username.trim(),
        role: form.role,
        nama_lengkap: form.nama_lengkap.trim() || null,
        no_telepon: form.no_telepon.trim() || null,
      };
      if (form.password) {
        if (form.password.length < 6) throw new Error("Password minimal 6 karakter");
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

  function save() {
    setErr("");
    saveMutation.mutate();
  }

  return { form, set, err, save, saving: saveMutation.isPending };
}
