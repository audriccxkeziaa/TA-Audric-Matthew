const express = require("express");
const router = express.Router();
const {
  listExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  getSummary,
} = require("../controllers/expensesController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

// Semua endpoint /api/expenses → admin only
router.use(authMiddleware, roleMiddleware("admin"));

router.get("/summary", getSummary);
router.get("/", listExpenses);
router.post("/", createExpense);
router.patch("/:id", updateExpense);
router.delete("/:id", deleteExpense);

module.exports = router;
