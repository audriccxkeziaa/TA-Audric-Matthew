const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/adjustmentController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.use(authMiddleware, roleMiddleware("kasir", "admin"));

router.post("/", ctrl.createAdjustment);
router.get("/", ctrl.listAdjustments);
router.get("/pending/count", ctrl.pendingCount);
router.get("/lookup/sale", ctrl.lookupSale);
router.get("/lookup/purchase", ctrl.lookupPurchase);

// Retur Supplier Tahap 2: barang ganti diterima (admin only — enforced in service layer)
router.post("/:id/resolve", ctrl.resolveSupplierReturn);

// Manager Override: remote approval (admin only — enforced in service layer)
router.post("/:id/approve", ctrl.approveAdjustment);
// Manager Override: on-site PIN verification (kasir+admin, tapi verifikasi admin credentials)
router.post("/:id/approve-pin", ctrl.approvePIN);
// Reject pending retur (admin only — enforced in service layer)
router.post("/:id/reject", ctrl.rejectAdjustment);

router.get("/:id", ctrl.getAdjustmentDetail);

module.exports = router;
