const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/adjustmentController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.use(authMiddleware, roleMiddleware("kasir", "admin"));

router.post("/", ctrl.createAdjustment);
router.get("/", ctrl.listAdjustments);
router.get("/lookup/sale", ctrl.lookupSale);
router.get("/lookup/purchase", ctrl.lookupPurchase);
router.get("/:id", ctrl.getAdjustmentDetail);

module.exports = router;
