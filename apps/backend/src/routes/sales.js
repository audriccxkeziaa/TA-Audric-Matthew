const express = require("express");
const router = express.Router();
const { createSale, listSales, getSaleDetail } = require("../controllers/salesController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

//  kasir & admin boleh transaksi penjualan
router.use(authMiddleware, roleMiddleware("kasir", "admin"));

router.post("/", createSale);
router.get("/", listSales);
router.get("/:id", getSaleDetail);

module.exports = router;
