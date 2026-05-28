#!/usr/bin/env node
// Script: Update existing users email to new format
// Jalankan: node database/updateUsersEmail.js

require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("❌ Environment variables SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY tidak ditemukan!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function updateUsersEmail() {
  try {
    console.log("📋 Mengambil data users yang ada...");
    
    // Cek users di app table (username + id)
    const { data: appUsers, error: fetchAppError } = await supabase
      .from("users")
      .select("id, username")
      .order("id");

    if (fetchAppError) {
      console.error("❌ Error fetch app users:", fetchAppError);
      return;
    }

    console.log(`\n📌 Users di app table (${appUsers.length}):`);
    appUsers.forEach((u) => {
      console.log(`  - ID: ${u.id}, Username: ${u.username}`);
    });

    if (appUsers.length === 0) {
      console.log("\n✅ Tidak ada users untuk di-update");
      return;
    }

    console.log(
      `\n🔄 Updating ${appUsers.length} users dengan format email baru (username@pos.local)...\n`
    );

    // Get list auth users untuk cek email sekarang
    const { data: { users: authUsers }, error: authFetchError } = await supabase.auth.admin.listUsers();

    if (authFetchError) {
      console.error("❌ Error fetch auth users:", authFetchError);
      return;
    }

    // Update setiap user di auth.users
    for (const appUser of appUsers) {
      const newEmail = `${appUser.username}@pos.local`;
      const authUser = authUsers.find((u) => u.id === appUser.id);
      
      if (!authUser) {
        console.log(`  ⚠️  ${appUser.username}: tidak ditemukan di auth.users`);
        continue;
      }

      const oldEmail = authUser.email;
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        appUser.id,
        { email: newEmail }
      );

      if (updateError) {
        console.log(`  ❌ ${appUser.username}: ${updateError.message}`);
      } else {
        console.log(`  ✅ ${appUser.username}: ${oldEmail} → ${newEmail}`);
      }
    }

    // Verify hasil update
    console.log("\n\n📋 Verifikasi auth.users setelah update:");
    const { data: { users: verifyUsers }, error: verifyError } = await supabase.auth.admin.listUsers();

    if (verifyError) {
      console.error("❌ Error verify users:", verifyError);
      return;
    }

    console.log(`✅ Auth users setelah update (${verifyUsers.length}):`);
    for (const appUser of appUsers) {
      const u = verifyUsers.find((au) => au.id === appUser.id);
      if (u) {
        console.log(
          `  - ID: ${appUser.id}, Username: ${appUser.username}, Email: ${u.email}`
        );
      }
    }

    console.log("\n✨ Update email users selesai!");
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

updateUsersEmail();
