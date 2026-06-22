const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");
const supabaseAdmin = require("../config/supabase");
const authMiddleware = require("../middleware/authMiddleware");

// POST /api/auth/login — login via username + password
// Supabase Auth membutuhkan email, jadi kita lookup email dari username dulu.
async function login(req, res) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username dan password wajib diisi." });
  }

  try {
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("users")
      .select("id, username, role, is_active")
      .eq("username", username.trim())
      .single();

    if (profileErr || !profile) {
      return res.status(401).json({ error: "Username atau password salah." });
    }

    // canRecover: hanya untuk akun ADMIN (yang username-nya benar). Dipakai
    // frontend untuk menampilkan opsi "Lupa Password?". Kasir TIDAK pernah
    // dapat flag ini (mereka reset lewat admin di Manajemen User). Username
    // yang tidak dikenal juga tidak dapat flag (cegah enumeration role).
    const canRecover = profile.role === "admin";

    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(profile.id);
    if (!authUser?.user?.email) {
      return res.status(401).json({ error: "Username atau password salah.", canRecover });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    const { data, error } = await supabase.auth.signInWithPassword({
      email: authUser.user.email,
      password,
    });

    if (error) {
      console.warn("[POS-AUTH] Login gagal untuk", username, "-", error.message);
      return res.status(401).json({ error: "Username atau password salah", canRecover });
    }

    // Status aktif dicek HANYA setelah kredensial benar → cegah enumeration
    // (akun nonaktif tidak terungkap tanpa password yang benar).
    if (profile.is_active === false) {
      return res.status(403).json({
        error: "Akun Anda telah dinonaktifkan. Hubungi admin untuk mengaktifkan kembali.",
      });
    }

    // Single-session: terbitkan ID sesi baru sebagai SATU-SATUNYA sesi aktif user
    // ini. Login baru menimpa active_session_id → sesi lama otomatis ditolak
    // authMiddleware. Catat juga "Terakhir Login" sekaligus (satu query); kolom
    // last_login_at ter-broadcast via Supabase Realtime → daftar user admin
    // update otomatis. Non-fatal bila gagal (mis. migrasi 048 belum diterapkan).
    const sessionId = crypto.randomUUID();
    const { error: stampErr } = await supabaseAdmin
      .from("users")
      .update({
        last_login_at: new Date().toISOString(),
        active_session_id: sessionId,
      })
      .eq("id", profile.id);
    if (stampErr) {
      console.warn("[POS-AUTH] Gagal catat last_login_at / set sesi:", stampErr.message);
    }
    // Bust cache profil agar sesi lama langsung memakai active_session_id baru
    // (penolakan sesi lama terjadi <2 detik, tidak menunggu TTL cache 60 detik).
    authMiddleware.invalidateProfile(profile.id);

    res.json({
      user: {
        id: data.user.id,
        username: profile.username,
        role: profile.role,
      },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
        session_id: sessionId,
      },
    });
  } catch (err) {
    console.error("[POS-AUTH] Login error:", err.message);
    res.status(500).json({ error: "Gagal login" });
  }
}

// POST /api/auth/logout — invalidate JWT di Supabase Auth (server-side sign out)
async function logout(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token tidak ditemukan" });
  }
  const token = authHeader.split(" ")[1];

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    await supabase.auth.signOut();

    // Lepas sesi aktif user ini agar slot single-session kosong. logout berada di
    // belakang authMiddleware → hanya sesi yang SAH (aktif) yang sampai sini,
    // jadi aman menghapus active_session_id miliknya sendiri.
    if (req.user?.id) {
      await supabaseAdmin
        .from("users")
        .update({ active_session_id: null })
        .eq("id", req.user.id);
      authMiddleware.invalidateProfile(req.user.id);
    }

    res.json({ message: "Logout berhasil." });
  } catch (err) {
    console.error("[POS-AUTH] Logout error:", err.message);
    res.status(500).json({ error: "Gagal logout" });
  }
}

// GET /api/auth/session-check — heartbeat single-session. authMiddleware sudah
// memvalidasi JWT, status akun, & kecocokan X-Session-Id; bila sesi ini sudah
// digantikan login baru, middleware membalas 401 SESSION_SUPERSEDED sebelum
// sampai sini. Handler cukup membalas OK (ringan, dipanggil tiap 1,5 detik).
function sessionCheck(req, res) {
  res.json({ ok: true });
}

// POST /api/auth/forgot-password — cek email terdaftar, lalu kirim link reset.
// Catatan: berbeda dari resetPasswordForEmail sisi client (yang selalu balas
// sukses untuk cegah enumeration), endpoint ini sengaja memberitahu bila email
// tidak terdaftar sesuai kebutuhan UX. Dibatasi rate-limit di router.
async function requestPasswordReset(req, res) {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email wajib diisi" });

  try {
    // Email disimpan di auth.users (bukan public.users) → cek lewat Admin API
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (error) throw error;

    const found = data?.users?.find(
      (u) => (u.email || "").toLowerCase() === email.trim().toLowerCase()
    );
    if (!found) {
      return res.status(404).json({ error: "Email tidak terdaftar." });
    }

    // Fitur reset hanya untuk ADMIN. Kasir mereset password lewat admin di
    // Manajemen User, bukan via email. Balas pesan yang sama dgn "tidak
    // terdaftar" agar tidak membocorkan email mana yg ada/role-nya (anti-enumeration).
    const { data: profile } = await supabaseAdmin
      .from("users")
      .select("role")
      .eq("id", found.id)
      .single();
    if (profile?.role !== "admin") {
      return res.status(404).json({ error: "Email tidak terdaftar." });
    }

    // Email ada → kirim link reset. Pakai klien ANON (alur publik resmi untuk
    // kirim email reset), bukan klien service-role.
    const origin = (process.env.FRONTEND_URL || "").split(",")[0].trim();
    // redirectTo wajib URL absolut & terdaftar di Supabase Redirect URLs.
    // Bila FRONTEND_URL belum diset, biarkan Supabase pakai Site URL default
    // (kirim redirectTo tanpa domain justru bisa ditolak Supabase).
    const resetOpts = origin
      ? { redirectTo: `${origin}/reset-password` }
      : {};
    if (!origin) {
      console.warn(
        "[POS-AUTH] FRONTEND_URL kosong — pakai Site URL default Supabase untuk redirect reset."
      );
    }
    const supabaseAnon = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
    const { error: rErr } = await supabaseAnon.auth.resetPasswordForEmail(
      email.trim(),
      resetOpts
    );
    if (rErr) {
      // Log lengkap (status + message) agar mudah didiagnosis dari log Railway.
      console.error(
        "[POS-AUTH] resetPasswordForEmail gagal:",
        rErr.status,
        rErr.message
      );
      // Pesan ramah pengguna; detail teknis cukup di log server.
      return res.status(502).json({
        error:
          "Gagal mengirim email reset. Coba lagi beberapa saat atau hubungi admin.",
      });
    }

    res.json({ message: "Link reset password telah dikirim. Cek inbox / folder spam." });
  } catch (err) {
    console.error("[POS-AUTH] forgot-password error:", err.message);
    res.status(500).json({ error: err.message || "Gagal mengirim link reset" });
  }
}

// POST /api/users — admin only, buat user baru (dipanggil dari users router)
// Email di-auto-generate dari username (username@pos.local) karena Supabase Auth butuh email.
async function register(req, res) {
  const { password, username, role, nama_lengkap, no_telepon } = req.body;

  if (!password || !username || !role) {
    return res.status(400).json({ error: "Username, password, dan role wajib diisi" });
  }
  if (!["admin", "kasir"].includes(role)) {
    return res.status(400).json({ error: "Role harus admin atau kasir" });
  }

  const autoEmail = `${username.trim().toLowerCase().replace(/\s+/g, "_")}@pos.local`;

  try {
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: autoEmail,
        password,
        email_confirm: true,
      });

    if (authError) {
      if (authError.message?.includes("already been registered")) {
        return res.status(409).json({ error: "Username sudah dipakai" });
      }
      return res
        .status(400)
        .json({ error: authError.message || "Gagal membuat user" });
    }

    const { error: profileError } = await supabaseAdmin.from("users").insert({
      id: authData.user.id,
      username: username.trim(),
      role,
      ...(nama_lengkap?.trim() && { nama_lengkap: nama_lengkap.trim() }),
      ...(no_telepon?.trim() && { no_telepon: no_telepon.trim() }),
    });

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      console.error("[POS-AUTH] Register profile error:", profileError.message);
      if (profileError.code === "23505") {
        return res.status(409).json({ error: "Username sudah dipakai" });
      }
      return res.status(400).json({ error: "Gagal menyimpan profil user" });
    }

    res.status(201).json({
      message: "User berhasil dibuat.",
      user: { id: authData.user.id, username: username.trim(), role },
    });
  } catch (err) {
    console.error("[POS-AUTH] Register error:", err.message);
    res.status(500).json({ error: "Gagal membuat user" });
  }
}

async function getMe(req, res) {
  res.json({
    user: {
      id: req.user.id,
      username: req.user.username,
      role: req.user.role,
      created_at: req.user.created_at,
    },
  });
}

// GET /api/users — daftar user (admin only)
async function listUsers(req, res) {
  try {
    const { data, error } = await supabaseAdmin
      .from("users")
      .select(
        "id, username, role, is_active, nama_lengkap, no_telepon, created_at, updated_at, last_login_at, sales(count)"
      )
      .order("username", { ascending: true });
    if (error) throw error;

    // "Terakhir Login" dibaca dari public.users.last_login_at (di-update oleh fn
    // login). Tabel ini ada di publication realtime → daftar user update otomatis.
    const rows = (data || []).map((u) => ({
      id: u.id,
      username: u.username,
      role: u.role,
      is_active: u.is_active,
      nama_lengkap: u.nama_lengkap || null,
      no_telepon: u.no_telepon || null,
      created_at: u.created_at,
      updated_at: u.updated_at,
      last_sign_in_at: u.last_login_at ?? null,
      total_transaksi: u.sales?.[0]?.count ?? 0,
    }));

    res.json({ data: rows });
  } catch (err) {
    console.error("[POS-AUTH] listUsers error:", err.message);
    res.status(500).json({ error: "Gagal memuat daftar user" });
  }
}

// PUT /api/users/:id — admin only. Update username / role / password.
async function updateUser(req, res) {
  const { id } = req.params;
  const { username, role, password, nama_lengkap, no_telepon } = req.body || {};

  if (username == null && role == null && password == null && nama_lengkap == null && no_telepon == null) {
    return res.status(400).json({ error: "Tidak ada field yang diubah" });
  }
  if (role != null && !["admin", "kasir"].includes(role)) {
    return res.status(400).json({ error: "Role harus admin atau kasir" });
  }
  if (username != null && (typeof username !== "string" || !username.trim())) {
    return res.status(400).json({ error: "Username tidak valid" });
  }

  if (id === req.user.id && role && role !== "admin") {
    return res.status(400).json({
      error: "Admin tidak boleh menurunkan role akunnya sendiri",
    });
  }

  try {
    const profilePatch = {};
    if (username) profilePatch.username = username.trim();
    if (role) profilePatch.role = role;
    if (nama_lengkap != null) profilePatch.nama_lengkap = nama_lengkap.trim() || null;
    if (no_telepon != null) profilePatch.no_telepon = no_telepon.trim() || null;
    // password TIDAK disimpan di tabel users — hanya di-set di Supabase Auth (authPatch).

    if (Object.keys(profilePatch).length > 0) {
      const { error: pErr } = await supabaseAdmin
        .from("users")
        .update(profilePatch)
        .eq("id", id);
      if (pErr) {
        if (pErr.code === "23505") {
          return res.status(409).json({ error: "Username sudah dipakai" });
        }
        throw pErr;
      }
    }

    const authPatch = {};
    if (username) {
      // Email internal di-regenerasi dari username HANYA jika email saat ini
      // masih placeholder @pos.local. Jangan timpa email asli (mis. email
      // recovery admin spt audriccmatthew@gmail.com) — kalau tertimpa, alur
      // "lupa password" lewat email jadi rusak.
      const { data: authUserData } = await supabaseAdmin.auth.admin.getUserById(id);
      const currentEmail = authUserData?.user?.email || "";
      if (currentEmail.endsWith("@pos.local") || currentEmail === "") {
        authPatch.email = `${username.trim().toLowerCase().replace(/\s+/g, "_")}@pos.local`;
      }
    }
    if (password) {
      if (typeof password !== "string" || password.length < 6) {
        return res
          .status(400)
          .json({ error: "Password minimal 6 karakter" });
      }
      authPatch.password = password;
    }
    if (Object.keys(authPatch).length > 0) {
      const { error: aErr } =
        await supabaseAdmin.auth.admin.updateUserById(id, authPatch);
      if (aErr) {
        return res.status(400).json({ error: aErr.message });
      }
    }

    console.log(
      `[POS-AUTH] User ${id} diupdate oleh ${req.user.username} (fields: ${Object.keys(
        { ...profilePatch, ...authPatch }
      ).join(",")})`
    );
    res.json({ message: "User berhasil diupdate." });
  } catch (err) {
    console.error("[POS-AUTH] updateUser error:", err.message);
    res.status(500).json({ error: "Gagal mengupdate user" });
  }
}

// PATCH /api/users/:id/status — admin only. Activate/deactivate akun.
// Soft-flag is_active di tabel users; authMiddleware menolak akses tiap request.
async function setUserStatus(req, res) {
  const { id } = req.params;
  const { is_active } = req.body || {};

  if (typeof is_active !== "boolean") {
    return res.status(400).json({ error: "Field 'is_active' (boolean) wajib diisi" });
  }

  // Self-protect: admin tidak boleh menonaktifkan akunnya sendiri
  if (id === req.user.id && is_active === false) {
    return res.status(400).json({
      error: "Admin tidak boleh menonaktifkan akunnya sendiri",
    });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("users")
      .update({ is_active })
      .eq("id", id)
      .select("id, username, role, is_active")
      .single();
    if (error) {
      if (error.code === "PGRST116")
        return res.status(404).json({ error: "User tidak ditemukan" });
      throw error;
    }

    // Berlaku LANGSUNG: bust cache profil agar request berikutnya (termasuk
    // heartbeat 1,5 detik) memakai is_active terbaru → user yang dinonaktifkan
    // ter-logout <2 detik, tidak menunggu TTL cache 60 detik. Saat dinonaktifkan,
    // lepas juga sesi aktifnya agar slot single-session bersih.
    authMiddleware.invalidateProfile(id);
    if (is_active === false) {
      await supabaseAdmin
        .from("users")
        .update({ active_session_id: null })
        .eq("id", id);
    }

    console.log(
      `[POS-AUTH] User ${data.username} ${is_active ? "diaktifkan" : "dinonaktifkan"} oleh ${req.user.username}`
    );
    res.json({
      message: `User berhasil ${is_active ? "diaktifkan" : "dinonaktifkan"}`,
      data,
    });
  } catch (err) {
    console.error("[POS-AUTH] setUserStatus error:", err.message);
    res.status(500).json({ error: "Gagal mengubah status user" });
  }
}

// DELETE /api/users/:id — admin only. Hard-delete user jika belum punya transaksi.
async function deleteUser(req, res) {
  const { id } = req.params;

  if (id === req.user.id) {
    return res.status(400).json({ error: "Tidak boleh menghapus akun sendiri" });
  }

  try {
    // Check all tables that reference users via user_id
    const checks = await Promise.all([
      supabaseAdmin.from("sales").select("id", { count: "exact", head: true }).eq("user_id", id),
      supabaseAdmin.from("purchases").select("id", { count: "exact", head: true }).eq("user_id", id),
      supabaseAdmin.from("expenses").select("id", { count: "exact", head: true }).eq("user_id", id),
      supabaseAdmin.from("stock_adjustments").select("id", { count: "exact", head: true }).eq("user_id", id),
    ]);

    for (const { error: checkErr } of checks) {
      if (checkErr) throw checkErr;
    }

    const [salesRes, purchasesRes, expensesRes, adjustmentsRes] = checks;
    const totalSales = salesRes.count ?? 0;
    const totalPurchases = purchasesRes.count ?? 0;
    const totalExpenses = expensesRes.count ?? 0;
    const totalAdjustments = adjustmentsRes.count ?? 0;
    const total = totalSales + totalPurchases + totalExpenses + totalAdjustments;

    if (total > 0) {
      return res.status(409).json({
        error: `User tidak dapat dihapus karena memiliki riwayat data (transaksi: ${totalSales}, pembelian: ${totalPurchases}, pengeluaran: ${totalExpenses}, penyesuaian: ${totalAdjustments}). Gunakan Deactivate sebagai gantinya.`,
      });
    }

    const { error } = await supabaseAdmin.from("users").delete().eq("id", id);
    if (error) {
      // FK violation — data exists in a related table we didn't check
      if (error.code === "23503") {
        return res.status(409).json({
          error: "User tidak dapat dihapus karena memiliki data terkait. Gunakan Deactivate sebagai gantinya.",
        });
      }
      throw error;
    }

    await supabaseAdmin.auth.admin.deleteUser(id);

    console.log(`[POS-AUTH] User ${id} dihapus oleh ${req.user.username}`);
    res.json({ message: "User berhasil dihapus" });
  } catch (err) {
    console.error("[POS-AUTH] deleteUser error:", err.message);
    res.status(500).json({ error: err.message || "Gagal menghapus user" });
  }
}

module.exports = {
  login,
  logout,
  sessionCheck,
  requestPasswordReset,
  register,
  getMe,
  listUsers,
  updateUser,
  setUserStatus,
  deleteUser,
};
