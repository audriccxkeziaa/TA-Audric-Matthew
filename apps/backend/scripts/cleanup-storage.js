// =================================================================
// scripts/cleanup-storage.js
// Hapus semua file di bucket nota-supplier (Supabase Storage).
// Jalankan sekali: node scripts/cleanup-storage.js
// =================================================================

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { createClient } = require("@supabase/supabase-js");

const BUCKET = "nota-supplier";
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function listAll(prefix = "") {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(prefix, { limit: 1000 });
  if (error) throw new Error("list error: " + error.message);
  return data || [];
}

async function deleteFiles(paths) {
  if (paths.length === 0) return;
  const { error } = await supabase.storage.from(BUCKET).remove(paths);
  if (error) throw new Error("delete error: " + error.message);
}

async function main() {
  console.log(`\nBucket: ${BUCKET}`);
  console.log("Mencari semua file...\n");

  // List folder tingkat atas (biasanya berupa user-id sebagai prefix)
  const topLevel = await listAll("");
  if (topLevel.length === 0) {
    console.log("Bucket sudah kosong. Tidak ada yang perlu dihapus.");
    return;
  }

  let allFilePaths = [];

  for (const entry of topLevel) {
    if (entry.id === null) {
      // Ini folder — list isinya
      const children = await listAll(entry.name);
      for (const child of children) {
        if (child.id !== null) {
          allFilePaths.push(`${entry.name}/${child.name}`);
        }
      }
    } else {
      // File langsung di root
      allFilePaths.push(entry.name);
    }
  }

  if (allFilePaths.length === 0) {
    console.log("Tidak ada file ditemukan.");
    return;
  }

  console.log(`Ditemukan ${allFilePaths.length} file:`);
  allFilePaths.forEach((p) => console.log("  •", p));

  // Hapus per batch 100
  const BATCH = 100;
  let deleted = 0;
  for (let i = 0; i < allFilePaths.length; i += BATCH) {
    const batch = allFilePaths.slice(i, i + BATCH);
    await deleteFiles(batch);
    deleted += batch.length;
    console.log(`\nDihapus ${deleted}/${allFilePaths.length}...`);
  }

  console.log(`\n✓ Selesai. ${deleted} file dihapus dari bucket "${BUCKET}".`);
}

main().catch((err) => {
  console.error("\n✗ Error:", err.message);
  process.exit(1);
});
