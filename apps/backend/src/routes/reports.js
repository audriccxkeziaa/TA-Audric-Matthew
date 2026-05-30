const express = require("express");
const router = express.Router();
const {
  getSalesReport,
  getPurchaseReport,
} = require("../controllers/reportsController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.use(authMiddleware);

// Kasir boleh lihat laporan penjualan (transaksi sendiri); pembelian admin-only.
router.get("/sales", roleMiddleware("admin", "kasir"), getSalesReport);
router.get("/purchases", roleMiddleware("admin"), getPurchaseReport);

module.exports = router;
