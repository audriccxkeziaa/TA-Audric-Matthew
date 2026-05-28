const express = require("express");
const router = express.Router();
const {
  getSalesReport,
  getPurchaseReport,
} = require("../controllers/reportsController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

//  laporan admin-only
router.use(authMiddleware, roleMiddleware("admin"));

router.get("/sales", getSalesReport);
router.get("/purchases", getPurchaseReport);

module.exports = router;
