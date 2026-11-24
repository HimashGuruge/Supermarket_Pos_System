// routes/settings.js
// Store settings. Everyone can read (the POS needs the
// currency symbol); only admin can change them.

const express = require("express");
const multer = require("multer");
const c = require("../controllers/settingsController");
const { requireAuth } = require("../middleware/auth");
const { authorize } = require("../middleware/authorize");

const router = express.Router();

// In-memory file storage: multer keeps the file in memory so we
// can check its type and size before the controller writes it.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // max 2 MB
});

router.use(requireAuth);

router.get("/", c.get);
router.put("/", authorize("admin"), c.update);

// POST /api/settings/logo  — admin only.
// Accepts one image file (field name "file"). Rejects anything
// that is not a real image or is over 2 MB with a clear message.
router.post("/logo", authorize("admin"), (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({ error: "Logo is too big (max 2 MB)" });
        return;
      }
      next(err);
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: "No image file uploaded" });
      return;
    }
    const allowed = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/gif",
      "image/webp",
      "image/svg+xml",
    ];
    if (!allowed.includes(req.file.mimetype)) {
      res
        .status(400)
        .json({ error: "Only image files are allowed (png, jpg, gif, webp, svg)" });
      return;
    }
    req.file.originalName = req.file.originalname;
    next();
  });
}, c.uploadLogo);

module.exports = router;
