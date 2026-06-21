const express = require("express");
const router = express.Router();
const { login, logout, getMe, requestPasswordReset } = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");
const rateLimit = require("../middleware/rateLimit");

// Batasi brute-force login: per (IP + username), maks 10 percobaan / menit.
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) =>
    `${req.ip}:${String(req.body?.username || "").toLowerCase()}`,
  message: "Terlalu banyak percobaan login. Coba lagi dalam 1 menit.",
});

// Batasi agar endpoint cek-email tidak dipakai menebak email secara massal.
const forgotLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 2,
  keyGenerator: (req) => req.ip || "unknown",
  message: "Terlalu banyak percobaan. Coba lagi dalam 1 menit.",
});

router.post("/login", loginLimiter, login);
router.post("/logout", authMiddleware, logout);
router.post("/forgot-password", forgotLimiter, requestPasswordReset);
router.get("/me", authMiddleware, getMe);

module.exports = router;
