// Definisi tiap endpoint REST backend, dikelompokkan per modul.

import { apiFetch } from "./api-client";

export const authApi = {
  login: (username, password) =>
    apiFetch("/auth/login", { method: "POST", body: { username, password } }),
  logout: () => apiFetch("/auth/logout", { method: "POST" }),
  me: () => apiFetch("/auth/me"),
};

export const productsApi = {
  // params: { q, limit, status, stock, merk }
  list: (params) => apiFetch("/products", { query: params }),
  merks: () => apiFetch("/products/merks"),
  get: (id) => apiFetch(`/products/${id}`),
  create: (body) => apiFetch("/products", { method: "POST", body }),
  update: (id, body) => apiFetch(`/products/${id}`, { method: "PATCH", body }),
};

export const salesApi = {
  // body: { items: [{ product_id, qty, harga_satuan }] }
  create: (body) => apiFetch("/sales", { method: "POST", body }),
  list: (params) => apiFetch("/sales", { query: params }),
  get: (id) => apiFetch(`/sales/${id}`),
};

export const purchasesApi = {
  // OCR upload: FormData berisi file + no_nota_supplier + nota_type (opsional)
  ocr: (formData) =>
    apiFetch("/purchases/ocr", { method: "POST", body: formData, isForm: true }),
  commit: (body) => apiFetch("/purchases/commit", { method: "POST", body }),
  list: (params) => apiFetch("/purchases", { query: params }),
  get: (id) => apiFetch(`/purchases/${id}`),
  drafts: {
    list: () => apiFetch("/purchases/drafts"),
    save: (body) => apiFetch("/purchases/drafts", { method: "POST", body }),
    get: (id) => apiFetch(`/purchases/drafts/${id}`),
    remove: (id) => apiFetch(`/purchases/drafts/${id}`, { method: "DELETE" }),
  },
  deleteFile: (fileUrl) =>
    apiFetch("/purchases/file", { method: "DELETE", body: { file_url: fileUrl } }),
};

export const restockApi = {
  list: () => apiFetch("/restock"),
};

export const dashboardApi = {
  summary: () => apiFetch("/dashboard/summary"),
  salesTrend: (days) => apiFetch("/dashboard/sales-trend", { query: { days } }),
  topProducts: (params) =>
    apiFetch("/dashboard/top-products", { query: params }),
  lowStock: () => apiFetch("/dashboard/low-stock"),
};

export const auditApi = {
  list: (params) => apiFetch("/audit-logs", { query: params }),
};

export const reportsApi = {
  sales: (params) => apiFetch("/reports/sales", { query: params }),
  purchases: (params) => apiFetch("/reports/purchases", { query: params }),
};

export const usersApi = {
  list: () => apiFetch("/users"),
  create: (body) => apiFetch("/users", { method: "POST", body }),
  update: (id, body) => apiFetch(`/users/${id}`, { method: "PUT", body }),
  setStatus: (id, is_active) =>
    apiFetch(`/users/${id}/status`, { method: "PATCH", body: { is_active } }),
};

export const notificationsApi = {
  lowStock: () => apiFetch("/notifications/low-stock"),
};

export const adjustmentsApi = {
  create: (body) => apiFetch("/adjustments", { method: "POST", body }),
  list: (params) => apiFetch("/adjustments", { query: params }),
  get: (id) => apiFetch(`/adjustments/${id}`),
  lookupSale: (kode) =>
    apiFetch("/adjustments/lookup/sale", { query: { kode } }),
  lookupPurchase: (nota) =>
    apiFetch("/adjustments/lookup/purchase", { query: { nota } }),
  pendingCount: () => apiFetch("/adjustments/pending/count"),
  resolveSupplier: (id) =>
    apiFetch(`/adjustments/${id}/resolve`, { method: "POST" }),
  approve: (id) =>
    apiFetch(`/adjustments/${id}/approve`, { method: "POST" }),
  approvePin: (id, { username, password }) =>
    apiFetch(`/adjustments/${id}/approve-pin`, {
      method: "POST",
      body: { username, password },
    }),
  reject: (id, reason) =>
    apiFetch(`/adjustments/${id}/reject`, {
      method: "POST",
      body: { reason },
    }),
};

export const expensesApi = {
  list: (params) => apiFetch("/expenses", { query: params }),
  create: (body) => apiFetch("/expenses", { method: "POST", body }),
  update: (id, body) => apiFetch(`/expenses/${id}`, { method: "PATCH", body }),
  remove: (id) => apiFetch(`/expenses/${id}`, { method: "DELETE" }),
  summary: (params) => apiFetch("/expenses/summary", { query: params }),
};
