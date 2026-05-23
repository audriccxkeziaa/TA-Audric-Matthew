"use client";
// =================================================================
// hooks/useToast.js — Notifikasi toast sederhana (sukses / error / info)
// =================================================================

import { createContext, useContext, useState, useCallback } from "react";

const ToastContext = createContext(null);

let counter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (message, type = "info") => {
      const id = ++counter;
      setToasts((t) => [...t, { id, message, type }]);
      setTimeout(() => dismiss(id), 4500);
    },
    [dismiss]
  );

  const toast = {
    success: (m) => push(m, "success"),
    error: (m) => push(m, "error"),
    info: (m) => push(m, "info"),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 no-print">
        {toasts.map((t) => (
          <div
            key={t.id}
            onClick={() => dismiss(t.id)}
            className={
              "cursor-pointer rounded-lg px-4 py-3 text-sm shadow-lg max-w-sm " +
              (t.type === "success"
                ? "bg-emerald-600 text-white"
                : t.type === "error"
                ? "bg-red-600 text-white"
                : "bg-slate-800 text-white")
            }
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast harus dipakai di dalam <ToastProvider>");
  return ctx;
}
