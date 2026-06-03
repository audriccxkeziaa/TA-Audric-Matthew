// lib/supabase.js — Klien Supabase sisi browser
// Login & verifikasi JWT tetap lewat backend Express (POST /api/auth/login).
// Klien ini HANYA dipakai untuk refresh access_token ketika hampir
// kedaluwarsa, supaya kasir tidak ter-logout di tengah transaksi.
// WAJIB pakai ANON KEY (publik) — service role key tidak boleh di browser.

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// persistSession=false: kita kelola token sendiri di localStorage (lihat
// api-client.js) supaya sinkron dengan header Authorization ke backend.
//
// flowType:'implicit' + detectSessionInUrl:true → khusus alur "lupa password"
// admin: link reset dari email mengembalikan token di URL hash sehingga bisa
// dibaca tanpa perlu code-verifier tersimpan (PKCE gagal karena persistSession
// false). Halaman /reset-password mengandalkan ini. Tidak memengaruhi login
// normal (lewat backend) maupun refresh token (pakai refresh_token grant).
export const supabase =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          flowType: "implicit",
          detectSessionInUrl: true,
        },
      })
    : null;
