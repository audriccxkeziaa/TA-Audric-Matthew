const express = require("express");
const multer = require("multer");
const router = express.Router();

const {
  processOcr,
  commitPurchase,
  listPurchases,
  getPurchaseDetailCtrl,
  listSupplierNames,
  saveDraft,
  listDrafts,
  getDraft,
  deleteDraft,
  deleteNotaFileCtrl,
} = require("../controllers/purchasesController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

// Terima JPG/PNG/WebP/PDF. Klasifikasi cetak vs tulisan tangan di service layer.
const ACCEPTED_MIME_RE = /^(image\/(jpeg|jpg|png|webp)|application\/pdf)$/i;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    if (!ACCEPTED_MIME_RE.test(file.mimetype)) {
      return cb(
        new Error("Format tidak didukung. Gunakan JPG / PNG / WebP / PDF.")
      );
    }
    cb(null, true);
  },
});

// Kasir & admin boleh input stok masuk
router.use(authMiddleware, roleMiddleware("kasir", "admin"));

// Wrapping multer agar error (file size / mimetype) jadi HTTP 400 yang rapi
function uploadSingleNota(req, res, next) {
  upload.single("file")(req, res, (err) => {
    if (err) {
      const message =
        err.code === "LIMIT_FILE_SIZE"
          ? "File terlalu besar (maks 10 MB)"
          : err.message;
      return res.status(400).json({ error: message });
    }
    next();
  });
}

router.post("/ocr", uploadSingleNota, processOcr);
router.post("/commit", commitPurchase);
router.get("/suppliers", listSupplierNames);
router.get("/", listPurchases);

// Drafts: scan di HP → resume di laptop (atau sebaliknya).
// Dipakai endpoints: POST /api/purchases/drafts (save), GET (list),
// GET /:id (load one), DELETE /:id (cancel).
router.get("/drafts", listDrafts);
router.post("/drafts", express.json({ limit: "5mb" }), saveDraft);
router.get("/drafts/:id", getDraft);
router.delete("/drafts/:id", deleteDraft);

// Hapus file nota dari Storage (cancel flow — harus sebelum /:id)
router.delete("/file", express.json(), deleteNotaFileCtrl);

// Must come after /drafts and /file to avoid catching them as :id
router.get("/:id", getPurchaseDetailCtrl);

module.exports = router;
