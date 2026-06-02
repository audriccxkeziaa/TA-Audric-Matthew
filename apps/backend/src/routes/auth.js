const express = require("express");
const router = express.Router();
const { login, logout, getMe } = require("../controllers/authController");
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

router.post("/login", loginLimiter, login);
router.post("/logout", authMiddleware, logout);
router.get("/me", authMiddleware, getMe);

module.exports = router;
