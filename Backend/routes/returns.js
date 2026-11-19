// routes/returns.js
// Refund URLs. Admin handles refunds; stock can also,
// since refunds move stock.

const express = require("express");
const c = require("../controllers/returnController");
const { requireAuth } = require("../middleware/auth");
const { authorize } = require("../middleware/authorize");

const router = express.Router();

router.use(requireAuth);

router.get("/", c.list);
router.get("/:id", c.getOne);
router.post("/", authorize("admin", "stock"), c.create);

module.exports = router;
