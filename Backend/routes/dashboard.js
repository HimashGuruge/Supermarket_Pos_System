// routes/dashboard.js
// Dashboard URLs. Any logged-in role can see the numbers,
// since they are store-wide totals, not sensitive data.

const express = require("express");
const c = require("../controllers/dashboardController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);

router.get("/stats", c.stats);
router.get("/daily-sales", c.dailySales);
router.get("/monthly-sales", c.monthlySales);
router.get("/profit", c.profit);
router.get("/top-products", c.topProducts);

module.exports = router;
