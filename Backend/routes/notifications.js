// routes/notifications.js
// Notification URLs. Any role can read and mark-as-read.

const express = require("express");
const c = require("../controllers/notificationController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);

router.get("/", c.list);
router.post("/read-all", c.markAllRead);
router.delete("/:id", c.remove);

module.exports = router;
