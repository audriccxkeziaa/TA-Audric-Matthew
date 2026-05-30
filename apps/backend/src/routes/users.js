const express = require("express");
const router = express.Router();
const {
  register,
  listUsers,
  updateUser,
  setUserStatus,
  deleteUser,
} = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

// Semua endpoint user-management hanya admin
router.use(authMiddleware, roleMiddleware("admin"));

// GET /api/users — daftar user (untuk filter audit-trail dropdown & halaman /admin/users)
router.get("/", listUsers);

// POST /api/users — buat user kasir/admin baru
router.post("/", register);

// PUT /api/users/:id — edit profil (username, role, email, password)
router.put("/:id", updateUser);

// PATCH /api/users/:id/status — aktifkan / nonaktifkan akun (soft delete)
router.patch("/:id/status", setUserStatus);

// DELETE /api/users/:id — hard delete (hanya jika user belum punya transaksi)
router.delete("/:id", deleteUser);

module.exports = router;
