// expensesController.js — Pengeluaran operasional & ringkasan keuangan
// Admin only (di-enforce oleh route). Memberikan:
//   GET    /api/expenses              list + filter tanggal
//   POST   /api/expenses              tambah pengeluaran
//   DELETE /api/expenses/:id          hapus
//   GET    /api/expenses/summary      ringkasan saldo (omset, biaya, bersih)

const supabase = require("../config/supabase");

const ALLOWED_JENIS = ["gaji", "listrik", "air", "supplier", "custom"];

// ---------- LIST ----------
async function listExpenses(req, res) {
  try {
    const { from, to, jenis, limit } = req.query;
    let q = supabase
      .from("expenses")
      .select("id, jenis, deskripsi, nominal, tanggal, user_id, created_at, users(username)")
      .order("tanggal", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(Math.min(parseInt(limit, 10) || 200, 1000));

    if (from) q = q.gte("tanggal", from);
    if (to) q = q.lte("tanggal", to);
    if (jenis && ALLOWED_JENIS.includes(jenis)) q = q.eq("jenis", jenis);

    const { data, error } = await q;
    if (error) throw error;

    const rows = (data || []).map((r) => ({
      id: r.id,
      jenis: r.jenis,
      deskripsi: r.deskripsi,
      nominal: Number(r.nominal),
      tanggal: r.tanggal,
      created_at: r.created_at,
      user_id: r.user_id,
      username: r.users?.username || null,
    }));
    res.json({ data: rows });
  } catch (err) {
    console.error("[POS-EXPENSES] list:", err.message);
    res.status(500).json({ error: "Gagal memuat pengeluaran" });
  }
}

// ---------- CREATE ----------
async function createExpense(req, res) {
  try {
    const { jenis, deskripsi, nominal, tanggal } = req.body || {};
    if (!ALLOWED_JENIS.includes(jenis)) {
      return res.status(400).json({ error: "Jenis tidak valid" });
    }
    if (!deskripsi || typeof deskripsi !== "string" || !deskripsi.trim()) {
      return res.status(400).json({ error: "Deskripsi wajib diisi" });
    }
    if (typeof nominal !== "number" || nominal <= 0) {
      return res.status(400).json({ error: "Nominal harus angka > 0" });
    }
    const tgl = tanggal && /^\d{4}-\d{2}-\d{2}$/.test(tanggal)
      ? tanggal
      : new Date().toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from("expenses")
      .insert({
        jenis,
        deskripsi: deskripsi.trim(),
        nominal,
        tanggal: tgl,
        user_id: req.user.id,
      })
      .select("id, jenis, deskripsi, nominal, tanggal, created_at")
      .single();
    if (error) throw error;

    console.log(
      `[POS-EXPENSES] +${nominal} ${jenis} oleh ${req.user.username}`
    );
    res.status(201).json({ message: "Pengeluaran dicatat", data });
  } catch (err) {
    console.error("[POS-EXPENSES] create:", err);
    // Bedakan error spesifik biar mudah debug
    const msg = err?.message || "";
    if (/invalid input value for enum/i.test(msg)) {
      return res.status(500).json({
        error:
          "Tipe enum expense_kind di database belum sinkron dengan aplikasi. Jalankan migrasi 015_expenses_rename_jenis.sql di Supabase SQL Editor.",
      });
    }
    if (/relation .* does not exist/i.test(msg) && /expenses/i.test(msg)) {
      return res.status(500).json({
        error:
          "Tabel expenses belum dibuat. Jalankan migrasi 013_expenses.sql di Supabase SQL Editor.",
      });
    }
    res.status(500).json({ error: msg || "Gagal menyimpan pengeluaran" });
  }
}

// ---------- UPDATE ----------
async function updateExpense(req, res) {
  try {
    const { id } = req.params;
    const { jenis, deskripsi, nominal, tanggal } = req.body || {};

    const patch = {};
    if (jenis != null) {
      if (!ALLOWED_JENIS.includes(jenis)) {
        return res.status(400).json({ error: "Jenis tidak valid" });
      }
      patch.jenis = jenis;
    }
    if (deskripsi != null) {
      if (typeof deskripsi !== "string" || !deskripsi.trim()) {
        return res.status(400).json({ error: "Deskripsi wajib diisi" });
      }
      patch.deskripsi = deskripsi.trim();
    }
    if (nominal != null) {
      if (typeof nominal !== "number" || nominal <= 0) {
        return res.status(400).json({ error: "Nominal harus angka > 0" });
      }
      patch.nominal = nominal;
    }
    if (tanggal != null) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
        return res.status(400).json({ error: "Tanggal tidak valid" });
      }
      patch.tanggal = tanggal;
    }

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: "Tidak ada field yang diubah" });
    }

    const { data, error } = await supabase
      .from("expenses")
      .update(patch)
      .eq("id", id)
      .select("id, jenis, deskripsi, nominal, tanggal, created_at")
      .single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Pengeluaran tidak ditemukan" });

    console.log(
      `[POS-EXPENSES] update ${id} oleh ${req.user.username} (${Object.keys(patch).join(",")})`
    );
    res.json({ message: "Pengeluaran diperbarui", data });
  } catch (err) {
    console.error("[POS-EXPENSES] update:", err);
    const msg = err?.message || "";
    if (/invalid input value for enum/i.test(msg)) {
      return res.status(500).json({
        error:
          "Tipe enum expense_kind di database belum sinkron. Jalankan migrasi 015 di Supabase SQL Editor.",
      });
    }
    res.status(500).json({ error: msg || "Gagal memperbarui pengeluaran" });
  }
}

// ---------- DELETE ----------
async function deleteExpense(req, res) {
  try {
    const { id } = req.params;
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) throw error;
    console.log(`[POS-EXPENSES] hapus ${id} oleh ${req.user.username}`);
    res.json({ message: "Pengeluaran dihapus" });
  } catch (err) {
    console.error("[POS-EXPENSES] delete:", err.message);
    res.status(500).json({ error: "Gagal menghapus pengeluaran" });
  }
}

// ---------- SUMMARY ----------
// Filter tanggal opsional. Default: all-time.
// Auto-hitung: omset_kotor (sales), total_pembelian (purchases tervalidasi),
// total_pengeluaran (expenses), saldo_bersih = omset - pembelian - pengeluaran.
async function getSummary(req, res) {
  try {
    const { from, to } = req.query;

    // Sales
    let salesQ = supabase.from("sales").select("total_harga, created_at");
    if (from) salesQ = salesQ.gte("created_at", from);
    if (to) salesQ = salesQ.lte("created_at", to);
    const { data: salesRows, error: salesErr } = await salesQ;
    if (salesErr) throw salesErr;
    const omset_kotor = (salesRows || []).reduce(
      (a, r) => a + Number(r.total_harga || 0),
      0
    );

    // Purchases tervalidasi
    let purchQ = supabase
      .from("purchases")
      .select("total, created_at, status_validasi")
      .eq("status_validasi", "tervalidasi");
    if (from) purchQ = purchQ.gte("created_at", from);
    if (to) purchQ = purchQ.lte("created_at", to);
    const { data: purchRows, error: purchErr } = await purchQ;
    if (purchErr) throw purchErr;
    const total_pembelian = (purchRows || []).reduce(
      (a, r) => a + Number(r.total || 0),
      0
    );

    // Expenses operasional
    let expQ = supabase.from("expenses").select("nominal, jenis, tanggal");
    if (from) expQ = expQ.gte("tanggal", from.slice(0, 10));
    if (to) expQ = expQ.lte("tanggal", to.slice(0, 10));
    const { data: expRows, error: expErr } = await expQ;
    if (expErr) throw expErr;
    const total_pengeluaran = (expRows || []).reduce(
      (a, r) => a + Number(r.nominal || 0),
      0
    );

    // Breakdown pengeluaran per jenis
    const per_jenis = {};
    for (const j of ALLOWED_JENIS) per_jenis[j] = 0;
    for (const r of expRows || []) {
      per_jenis[r.jenis] = (per_jenis[r.jenis] || 0) + Number(r.nominal || 0);
    }

    const saldo_bersih = omset_kotor - total_pembelian - total_pengeluaran;

    res.json({
      data: {
        omset_kotor,
        total_pembelian,
        total_pengeluaran,
        saldo_bersih,
        per_jenis,
        n_sales: salesRows?.length || 0,
        n_purchases: purchRows?.length || 0,
        n_expenses: expRows?.length || 0,
      },
    });
  } catch (err) {
    console.error("[POS-EXPENSES] summary:", err.message);
    res.status(500).json({ error: "Gagal memuat ringkasan keuangan" });
  }
}

module.exports = {
  listExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  getSummary,
  ALLOWED_JENIS,
};
