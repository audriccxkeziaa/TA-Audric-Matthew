const { createClient } = require("@supabase/supabase-js");
const supabaseAdmin = require("../config/supabase");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// Klien SINGLETON khusus verifikasi JWT. getClaims() memverifikasi token secara
// LOKAL menggunakan JWKS Supabase (di-cache di instance klien ini), sehingga
// tidak ada round-trip jaringan ke Supabase Auth pada setiap request — ini
// pemangkas latensi utama dibanding auth.getUser() yang memanggil jaringan.
const authClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Cache profil pengguna (role, is_active, dll.) agar tidak query tabel users
// pada setiap request. TTL singkat menjaga data tetap mutakhir.
const profileCache = new Map(); // userId -> { profile, exp }
const PROFILE_TTL_MS = 60_000;

// Verifikasi JWT Supabase (signature, exp, sub) lalu attach profil user.
async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token tidak ditemukan" });
  }

  const token = authHeader.split(" ")[1];

  try {
    // 1) Verifikasi JWT secara LOKAL via JWKS (tanpa panggilan jaringan).
    let userId = null;
    let email = null;
    try {
      const { data: claimsData, error: claimsError } =
        await authClient.auth.getClaims(token);
      const claims = claimsData?.claims;
      // getClaims sudah memverifikasi signature & masa berlaku; cek exp sekali
      // lagi sebagai pengaman tambahan.
      if (!claimsError && claims?.sub && (!claims.exp || claims.exp * 1000 > Date.now())) {
        userId = claims.sub;
        email = claims.email || null;
      }
    } catch (_) {
      /* lanjut ke fallback di bawah */
    }

    // 2) Fallback AMAN: bila verifikasi lokal gagal/tidak konklusif, verifikasi
    //    via jaringan (perilaku lama). Token tidak sah tetap ditolak di sini.
    if (!userId) {
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (error || !user) {
        return res.status(401).json({ error: "Token tidak valid atau kedaluwarsa" });
      }
      userId = user.id;
      email = user.email || null;
    }

    // 3) Ambil profil dari cache; bila tidak ada, query lalu simpan ke cache.
    let profile = null;
    const hit = profileCache.get(userId);
    if (hit && hit.exp > Date.now()) {
      profile = hit.profile;
    } else {
      const { data, error: profileError } = await supabaseAdmin
        .from("users")
        .select("*")
        .eq("id", userId)
        .single();
      if (profileError || !data) {
        return res.status(401).json({ error: "Profil user tidak ditemukan" });
      }
      profile = data;
      profileCache.set(userId, { profile, exp: Date.now() + PROFILE_TTL_MS });
    }

    // Akun yang dinonaktifkan langsung kehilangan akses walau JWT masih valid.
    if (profile.is_active === false) {
      profileCache.delete(userId);
      return res.status(401).json({ error: "Akun Anda telah dinonaktifkan" });
    }

    req.user = { ...profile, id: userId, email: email || profile.email };
    next();
  } catch (err) {
    console.error("[POS-AUTH] Authentikasi error:", err.message);
    return res.status(401).json({ error: "Autentikasi gagal" });
  }
}

module.exports = authMiddleware;
