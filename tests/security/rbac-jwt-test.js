// =================================================================
// tests/security/rbac-jwt-test.js — Uji RBAC & Integritas JWT
// =================================================================
// Skrip Node murni (butuh Node 18+ untuk global fetch). Menguji:
//   A. RBAC privilege escalation — kasir tidak boleh akses endpoint admin
//   B. JWT tampering             — token dimanipulasi harus ditolak 401
//
// Jalankan saat backend hidup:
//   node tests/security/rbac-jwt-test.js
//
// Env (opsional, ada default):
//   BASE_URL, KASIR_EMAIL, KASIR_PASSWORD
// =================================================================

const BASE_URL = process.env.BASE_URL || "http://localhost:5000/api";
const KASIR_EMAIL = process.env.KASIR_EMAIL || "kasir@asiajaya.com";
const KASIR_PASSWORD = process.env.KASIR_PASSWORD || "kasir123";

const results = [];
function record(id, label, expected, actual) {
  const pass = actual === expected;
  results.push({ id, label, expected, actual, pass });
  const tag = pass ? "PASS" : "FAIL";
  console.log(
    `[${id}] ${label.padEnd(42)} → ${String(actual).padEnd(4)} (harap ${expected})  ${tag}`
  );
}

// Login kasir untuk memperoleh JWT yang sah.
async function loginKasir() {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: KASIR_EMAIL, password: KASIR_PASSWORD }),
  });
  if (!res.ok) {
    throw new Error(
      `Login kasir gagal (${res.status}). Set KASIR_EMAIL & KASIR_PASSWORD ke akun role 'kasir' yang valid.`
    );
  }
  const json = await res.json();
  if (json.user?.role !== "kasir") {
    console.warn(
      `[WARN] Akun login ber-role '${json.user?.role}', idealnya 'kasir' untuk uji RBAC.`
    );
  }
  return json.session.access_token;
}

// Ubah 1 karakter terakhir signature JWT.
function tamperSignature(token) {
  const parts = token.split(".");
  const sig = parts[2];
  const last = sig.slice(-1);
  const replacement = last === "A" ? "B" : "A";
  parts[2] = sig.slice(0, -1) + replacement;
  return parts.join(".");
}

// Ubah klaim payload (role → admin) tanpa re-sign yang valid.
function tamperPayloadRole(token) {
  const parts = token.split(".");
  const payload = JSON.parse(
    Buffer.from(parts[1], "base64url").toString("utf8")
  );
  payload.role = "admin";
  payload.user_metadata = { ...(payload.user_metadata || {}), role: "admin" };
  parts[1] = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return parts.join("."); // signature lama → tidak cocok
}

async function statusOf(path, { method = "GET", token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers["Content-Type"] = "application/json";
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.status;
}

async function main() {
  console.log("=== Uji Keamanan: RBAC & Integritas JWT ===\n");
  const kasirToken = await loginKasir();

  // ---------- A. RBAC Privilege Escalation ----------
  record(
    "A1",
    "Kasir POST /users (endpoint admin)",
    403,
    await statusOf("/users", {
      method: "POST",
      token: kasirToken,
      body: { email: "x@x.com", password: "xxxxxx", username: "x", role: "kasir" },
    })
  );
  record(
    "A2",
    "GET /users tanpa JWT",
    401,
    await statusOf("/users")
  );
  record(
    "A3",
    "Kasir GET /audit-logs (admin only)",
    403,
    await statusOf("/audit-logs", { token: kasirToken })
  );

  // ---------- B. JWT Tampering ----------
  record(
    "B1",
    "Signature JWT di-tamper",
    401,
    await statusOf("/auth/me", { token: tamperSignature(kasirToken) })
  );
  record(
    "B2",
    "Payload role di-tamper jadi admin",
    401,
    await statusOf("/auth/me", { token: tamperPayloadRole(kasirToken) })
  );
  record(
    "B3",
    "JWT format rusak / bukan token",
    401,
    await statusOf("/auth/me", { token: "ini.bukan.jwt" })
  );

  // ---------- Ringkasan ----------
  const passed = results.filter((r) => r.pass).length;
  console.log(`\n${passed}/${results.length} PASS`);
  if (passed !== results.length) {
    console.log("Ada kasus GAGAL — periksa middleware auth/RBAC.");
    process.exit(1);
  }
  console.log("Semua kontrol keamanan RBAC & JWT bekerja sesuai harapan.");
}

main().catch((err) => {
  console.error("\n[ERROR]", err.message);
  process.exit(1);
});
