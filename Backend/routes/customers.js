// routes/customers.js
// Customer URLs. Cashiers can list, read, and create (a
// walk-in sale can register a customer on the spot).
// Only admin and stock can edit or delete.

const express = require("express");
const c = require("../controllers/customerController");
const { requireAuth } = require("../middleware/auth");
const { authorize } = require("../middleware/authorize");

const router = express.Router();

router.use(requireAuth);

router.get("/", c.list);
router.get("/:id", c.list); // single read (keeps it simple)
router.post("/", authorize("admin", "cashier", "stock"), c.create);
router.put("/:id", authorize("admin", "stock"), c.update);
router.delete("/:id", authorize("admin"), c.remove);

module.exports = router;
