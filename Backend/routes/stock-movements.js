// routes/stock-movements.js
// The audit trail of every stock change.
// Anyone logged in can read; only stock and admin write
// (a manual "adjust" for counting errors).

const express = require("express");
const StockMovement = require("../models/StockMovement");
const Product = require("../models/Product");
const { requireAuth } = require("../middleware/auth");
const { authorize } = require("../middleware/authorize");

const router = express.Router();

router.use(requireAuth);

// GET /api/stock-movements?product=<id>
// Newest first. If a product id is given, only that product's
// history is returned (used by the product detail page).
router.get("/", async (req, res) => {
  const q = {};
  if (req.query.product) q.product = req.query.product;
  const items = await StockMovement.find(q)
    .sort({ createdAt: -1 })
    .limit(500)
    .populate("product", "name barcode")
    .populate("doneBy", "name");
  res.json(items);
});

// POST /api/stock-movements  — manual stock adjust.
// Body: { product: <id>, adjust: <number>, reason }
// adjust can be positive (found extra stock) or negative
// (stock missing, damaged, etc.). The product stock is
// changed by the same amount in the same request.
router.post(
  "/",
  authorize("admin", "stock"),
  async (req, res) => {
    const { product, adjust, reason = "" } = req.body;
    if (!product || typeof adjust !== "number" || adjust === 0) {
      res.status(400).json({ error: "product and a non-zero adjust are required" });
      return;
    }
    const p = await Product.findById(product);
    if (!p) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    if (p.stock + adjust < 0) {
      res.status(400).json({ error: "Adjustment would make stock negative" });
      return;
    }
    p.stock += adjust;
    await p.save();
    const m = await StockMovement.create({
      product,
      type: "adjust",
      quantity: Math.abs(adjust),
      reason: reason || "Manual adjustment",
      doneBy: req.userId,
    });
    res.status(201).json(m);
  }
);

module.exports = router;
