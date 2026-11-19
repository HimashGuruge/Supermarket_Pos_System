// routes/suppliers.js
// Read-only supplier URLs. The purchase form uses GET /api/suppliers
// to fill its supplier dropdown. Full supplier CRUD is a later phase.

const express = require("express");
const c = require("../controllers/supplierController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);

// GET  /api/suppliers — list (any logged-in role).
router.get("/", c.list);

// GET  /api/suppliers/:id — one supplier (any logged-in role).
router.get("/:id", c.getOne);

module.exports = router;
