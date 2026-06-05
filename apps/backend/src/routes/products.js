const express = require("express");
const router = express.Router();
const {
  searchProducts,
  listMerks,
  listCatalog,
  getProduct,
  createProduct,
  updateProduct,
} = require("../controllers/productsController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.use(authMiddleware, roleMiddleware("kasir", "admin"));

router.get("/", searchProducts);
router.get("/merks", listMerks);
// PENTING: /catalog harus sebelum /:id agar tidak ditangkap sebagai param :id
router.get("/catalog", listCatalog);
router.get("/:id", getProduct);
router.post("/", createProduct);
router.patch("/:id", updateProduct);

module.exports = router;
