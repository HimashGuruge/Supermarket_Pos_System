// routes/settings.js
// Store settings. Everyone can read (the POS needs the
// currency symbol); only admin can change them.

const express = require("express");
const c = require("../controllers/settingsController");
const { requireAuth } = require("../middleware/auth");
const { authorize } = require("../middleware/authorize");

const router = express.Router();

router.use(requireAuth);

router.get("/", c.get);
router.put("/", authorize("admin"), c.update);

module.exports = router;
