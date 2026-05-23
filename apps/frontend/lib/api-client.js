// =================================================================
// lib/api-client.js — Pembungkus fetch ke backend Express REST API
// =================================================================
// Tanggung jawab:
//   - Menyimpan/membaca sesi (access_token, refresh_token, user) di localStorage
//   - Menyisipkan header Authorization: Bearer <token> tiap request
//   - Refresh token via Supabase ketika hampir kedaluwarsa (Lapisan 3)
//   - Menerjemahkan error backend jadi ApiError yang membawa status + rule
// =================================================================

import { supabase } from "./supabase";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
const SESSION_KEY = "pos.session";

// ---------- Error khusus ----------
// Membawa `status` HTTP dan `rule` (R1-R5) supaya UI bisa kasih pesan tepat.
export class ApiError extends Error {
  constructor(message, { status, rule, failures } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.rule = rule || null;
    this.failures = failures || null;
  }
}

// ---------- Manajemen sesi (localStorage) ----------
export function getSession() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setSession(session) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_KEY);
}

// ---------- Refresh token (Lapisan 3) ----------
// Dipanggil sebelum tiap request. Kalau access_token kedaluwarsa < 60 detik
// lagi, tukar refresh_token jadi token baru lewat Supabase.
async function ensureFreshToken() {
  const session = getSession();
  if (!session?.access_token) return null;

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = session.expires_at || 0;
  const stillValid = expiresAt - now > 60;
  if (stillValid || !supabase || !session.refresh_token) {
    return session.access_token;
  }

  try {
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: session.refresh_token,
    });
    if (error || !data?.session) throw error || new Error("refresh gagal");
    const next = {
      ...session,
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
    };
    setSession(next);
    return next.access_token;
  } catch {
    // Refresh gagal → token mati. Biarkan request jalan; backend balas 401.
    return session.access_token;
  }
}

// ---------- Inti: apiFetch ----------
// options: { method, body, isForm, signal, query }
//   - body objek biasa → dikirim sebagai JSON
//   - isForm=true → body dianggap FormData (untuk upload nota OCR)
export async function apiFetch(path, options = {}) {
  const { method = "GET", body, isForm = false, signal, query } = options;

  let url = `${API_URL}${path}`;
  if (query && typeof query === "object") {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== "") qs.append(k, v);
    }
    const s = qs.toString();
    if (s) url += `?${s}`;
  }

  const token = await ensureFreshToken();
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload;
  if (isForm) {
    payload = body; // FormData — biarkan browser set Content-Type + boundary
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const res = await fetch(url, { method, headers, body: payload, signal });

  // Unduhan CSV — kembalikan Blob mentah.
  const contentType = res.headers.get("content-type") || "";
  if (res.ok && contentType.includes("text/csv")) {
    return res.blob();
  }

  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  if (!res.ok) {
    // 401 di mana pun → sesi mati, paksa kembali ke halaman login.
    if (res.status === 401 && typeof window !== "undefined") {
      clearSession();
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    throw new ApiError(json?.error || `Permintaan gagal (${res.status})`, {
      status: res.status,
      rule: json?.rule,
      failures: json?.failures,
    });
  }

  return json;
}

// ---------- Helper unduh file (CSV) ----------
export async function downloadFile(path, { query, filename } = {}) {
  const blob = await apiFetch(path, { query });
  const objUrl = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objUrl;
  a.download = filename || "export.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(objUrl);
}

export { API_URL };
