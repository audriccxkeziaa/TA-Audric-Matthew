"use client";
// features/restock/hooks/useRestockDetail.js — state & mutation ubah min_stock
// dari modal detail restock. Invalidate restock + notifikasi low-stock.

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { productsApi } from "@/lib/api";
import { useToast } from "@/hooks/useToast";

export function useRestockDetail({ item, onClose }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [value, setValue] = useState("");
  const [alasan, setAlasan] = useState("");

  const save = useMutation({
    mutationFn: () =>
      productsApi.update(item.id, {
        min_stock: parseInt(value, 10) || 0,
        alasan,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["restock"] });
      qc.invalidateQueries({ queryKey: ["notif-low-stock"] });
      toast.success(`Min. stok "${item?.nama_barang}" diperbarui`);
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  function reset() {
    setValue("");
    setAlasan("");
  }

  return { value, setValue, alasan, setAlasan, save, reset };
}
