"use client";
// features/users/hooks/useAddUser.js — state form + mutation tambah user baru.

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usersApi } from "@/lib/api";
import { useToast } from "@/hooks/useToast";

export function useAddUser({ onClose }) {
  const qc = useQueryClient();
  const toast = useToast();

  const [form, setForm] = useState({ username: "", password: "", role: "kasir" });
  const [err, setErr] = useState("");

  function set(f, v) {
    setForm((s) => ({ ...s, [f]: v }));
  }

  const mutation = useMutation({
    mutationFn: async () => {
      if (!form.username.trim()) throw new Error("Username wajib diisi");
      if (!form.password) throw new Error("Password wajib diisi");
      if (form.password.length < 6)
        throw new Error("Password minimal 6 karakter");
      return usersApi.create({
        username: form.username.trim(),
        password: form.password,
        role: form.role,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success("User ditambahkan");
      onClose();
    },
    onError: (e) => setErr(e.message),
  });

  function submit() {
    setErr("");
    mutation.mutate();
  }

  return { form, set, err, submit, saving: mutation.isPending };
}
