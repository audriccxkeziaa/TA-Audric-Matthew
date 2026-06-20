const express = require("express");
const router = express.Router();
const {
  getSummary,
  getSalesTrend,
  getTopProducts,
} = require("../controllers/dashboardController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

//  dashboard analytics admin-only
router.use(authMiddleware, roleMiddleware("admin"));

router.get("/summary", getSummary);
router.get("/sales-trend", getSalesTrend);
router.get("/top-products", getTopProducts);

module.exports = router;
