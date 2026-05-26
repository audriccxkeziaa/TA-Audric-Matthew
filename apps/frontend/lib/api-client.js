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
const SESSION_PREFIX = "pos.session.";
const TAB_USER_KEY = "pos.active_user";

// ---------- Error khusus ----------
export class ApiError extends Error {
  constructor(message, { status, rule, failures } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.rule = rule || null;
    this.failures = failures || null;
  }
}

// ---------- Manajemen sesi ----------
// Session data disimpan di localStorage (pos.session.<user_id>) supaya
// tahan page-refresh. Pointer "user mana yang aktif di tab ini" disimpan
// di sessionStorage (per-tab) sehingga admin di tab A dan kasir di tab B
// tidak saling menimpa.
function activeUid() {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(TAB_USER_KEY) || null;
}

export function getSession() {
  if (typeof window === "undefined") return null;
  try {
    const uid = activeUid();
    if (uid) {
      const raw = window.localStorage.getItem(`${SESSION_PREFIX}${uid}`);
      return raw ? JSON.parse(raw) : null;
    }
    // Migrasi dari format lama (pos.session tunggal)
    const legacy = window.localStorage.getItem("pos.session");
    if (legacy) {
      const parsed = JSON.parse(legacy);
      if (parsed?.user?.id) {
        setSession(parsed);
        window.localStorage.removeItem("pos.session");
        return parsed;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function setSession(session) {
  if (typeof window === "undefined") return;
  const uid = session?.user?.id;
  if (!uid) return;
  window.sessionStorage.setItem(TAB_USER_KEY, uid);
  window.localStorage.setItem(`${SESSION_PREFIX}${uid}`, JSON.stringify(session));
}

export function clearSession() {
  if (typeof window === "undefined") return;
  const uid = activeUid();
  if (uid) window.localStorage.removeItem(`${SESSION_PREFIX}${uid}`);
  window.sessionStorage.removeItem(TAB_USER_KEY);
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
