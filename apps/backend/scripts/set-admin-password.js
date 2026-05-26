require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const NEW_PASSWORD = process.argv[2] || "admin123";

async function main() {
  const { data: profile, error: pErr } = await supabase
    .from("users")
    .select("id, username, role")
    .eq("role", "admin")
    .limit(1)
    .single();

  if (pErr || !profile) {
    console.error("Admin user tidak ditemukan di tabel users:", pErr?.message);
    process.exit(1);
  }

  console.log(`Found admin: ${profile.username} (${profile.id})`);

  const { error } = await supabase.auth.admin.updateUserById(profile.id, {
    password: NEW_PASSWORD,
  });

  if (error) {
    console.error("Gagal set password:", error.message);
    process.exit(1);
  }

  console.log(`Password untuk "${profile.username}" berhasil di-set.`);
}

main();
