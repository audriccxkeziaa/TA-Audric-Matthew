const { createClient } = require("@supabase/supabase-js");
const supabaseAdmin = require("../config/supabase");

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

    if (profile.is_active === false) {
      return res.status(403).json({ error: "Akun Anda telah dinonaktifkan. Hubungi admin untuk mengaktifkan kembali." });
    }

    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(profile.id);
    if (!authUser?.user?.email) {
      return res.status(401).json({ error: "Username atau password salah." });
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
      return res.status(401).json({ error: "Username atau password salah" });
    }

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
    res.json({ message: "Logout berhasil." });
  } catch (err) {
    console.error("[POS-AUTH] Logout error:", err.message);
    res.status(500).json({ error: "Gagal logout" });
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
        "id, username, role, is_active, nama_lengkap, no_telepon, created_at, updated_at, sales(count)"
      )
      .order("username", { ascending: true });
    if (error) throw error;

    const rows = (data || []).map((u) => ({
      id: u.id,
      username: u.username,
      role: u.role,
      is_active: u.is_active,
      nama_lengkap: u.nama_lengkap || null,
      no_telepon: u.no_telepon || null,
      created_at: u.created_at,
      updated_at: u.updated_at,
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
      authPatch.email = `${username.trim().toLowerCase().replace(/\s+/g, "_")}@pos.local`;
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
  register,
  getMe,
  listUsers,
  updateUser,
  setUserStatus,
  deleteUser,
};
