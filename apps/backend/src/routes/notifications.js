const express = require("express");
const router = express.Router();
const { getLowStockNotifications } = require("../controllers/notificationsController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

// Admin dan kasir keduanya butuh tahu barang menipis
router.use(authMiddleware, roleMiddleware("admin", "kasir"));

router.get("/low-stock", getLowStockNotifications);

module.exports = router;
