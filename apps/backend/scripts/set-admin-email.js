// scripts/set-admin-email.js — set email akun ADMIN ke email asli (untuk fitur
// reset password via email). Email primary di Supabase TIDAK aman diubah via SQL
// (auth.users dikelola GoTrue + ada tabel auth.identities) — wajib lewat Admin API.
//
// Jalankan dari folder apps/backend (butuh .env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY):
//   node scripts/set-admin-email.js <email_baru> [username_admin]
// Contoh:
//   node scripts/set-admin-email.js audriccmatthew@gmail.com
//   node scripts/set-admin-email.js audriccmatthewgmail.com superadmin
//
// Login tetap pakai USERNAME + password lama (tak berubah) — email hanya jadi
// alamat tujuan link reset password.

require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const NEW_EMAIL = process.argv[2];
const USERNAME = process.argv[3] || null;

function isEmail(s) {
  return typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

async function main() {
  if (!isEmail(NEW_EMAIL)) {
    console.error("Email tidak valid. Pakai: node scripts/set-admin-email.js <email> [username]");
    process.exit(1);
  }

  // Cari akun admin target (per username bila diberikan, agar tidak salah akun
  // kalau admin lebih dari satu).
  let query = supabase.from("users").select("id, username, role").eq("role", "admin");
  if (USERNAME) query = query.eq("username", USERNAME);

  const { data: admins, error: qErr } = await query;
  if (qErr) {
    console.error("Gagal query admin:", qErr.message);
    process.exit(1);
  }
  if (!admins || admins.length === 0) {
    console.error(USERNAME ? `Admin "${USERNAME}" tidak ditemukan.` : "Tidak ada akun admin.");
    process.exit(1);
  }
  if (admins.length > 1) {
    console.error(
      `Ada ${admins.length} admin: ${admins.map((a) => a.username).join(", ")}. ` +
      "Sebutkan username target: node scripts/set-admin-email.js <email> <username>"
    );
    process.exit(1);
  }

  const admin = admins[0];

  // Email saat ini (info sebelum diubah)
  const { data: before } = await supabase.auth.admin.getUserById(admin.id);
  console.log(`Admin: ${admin.username} (${admin.id})`);
  console.log(`Email lama : ${before?.user?.email || "(kosong)"}`);

  // Update via Admin API + email_confirm:true → langsung terkonfirmasi (tak perlu
  // email konfirmasi), siap menerima link reset password.
  const { data, error } = await supabase.auth.admin.updateUserById(admin.id, {
    email: NEW_EMAIL,
    email_confirm: true,
  });
  if (error) {
    console.error("Gagal set email:", error.message);
    process.exit(1);
  }

  console.log(`Email baru : ${data.user.email}  ✓`);
  console.log("Selesai. Login tetap pakai username + password lama.");
}

main();
