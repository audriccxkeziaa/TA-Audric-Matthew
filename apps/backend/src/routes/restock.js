const express = require("express");
const router = express.Router();
const { getRestockRecommendations } = require("../controllers/restockController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

// R5 — Rekomendasi Restock. Admin + kasir bisa baca (view-only untuk kasir).
router.use(authMiddleware, roleMiddleware("admin", "kasir"));

router.get("/", getRestockRecommendations);

module.exports = router;
