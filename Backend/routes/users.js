// routes/users.js
// User management. Admin only.

const express = require("express");
const c = require("../controllers/userController");
const { requireAuth } = require("../middleware/auth");
const { authorize } = require("../middleware/authorize");

const router = express.Router();

router.use(requireAuth, authorize("admin"));

router.get("/", c.list);
router.post("/", c.create);
router.put("/:id", c.update);
router.delete("/:id", c.remove);

module.exports = router;
