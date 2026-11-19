// routes/products.js
// Product URLs. POS (cashier) only needs to read and search;
// only admin and stock can create, edit, or delete.

const express = require("express");
const c = require("../controllers/productController");
const { requireAuth } = require("../middleware/auth");
const { authorize } = require("../middleware/authorize");

const router = express.Router();

// Every product route needs a logged-in user.
router.use(requireAuth);

// GET  /api/products   — any role can list/search (POS uses this).
router.get("/", c.list);

// GET  /api/products/:id — any role can read one.
router.get("/:id", c.getOne);

// POST /api/products   — admin or stock.
router.post("/", authorize("admin", "stock"), c.create);

// PUT  /api/products/:id — admin or stock.
router.put("/:id", authorize("admin", "stock"), c.update);

// DELETE /api/products/:id — admin only.
router.delete("/:id", authorize("admin"), c.remove);

module.exports = router;
