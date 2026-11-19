// routes/categories.js
// Category URLs. Read is open to all roles; changes are
// admin or stock only.

const express = require("express");
const c = require("../controllers/categoryController");
const { requireAuth } = require("../middleware/auth");
const { authorize } = require("../middleware/authorize");

const router = express.Router();

router.use(requireAuth);

router.get("/", c.list);
router.post("/", authorize("admin", "stock"), c.create);
router.put("/:id", authorize("admin", "stock"), c.update);
router.delete("/:id", authorize("admin"), c.remove);

module.exports = router;
