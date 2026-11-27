// routes/users.js
// User management. Admin only.

const express = require("express");
const multer = require("multer");
const c = require("../controllers/userController");
const { requireAuth } = require("../middleware/auth");
const { authorize } = require("../middleware/authorize");

const router = express.Router();

// In-memory file storage: multer keeps the file in memory so we
// can check its type and size before the controller writes it.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // max 2 MB
});

// Everyone must be logged in.
router.use(requireAuth);

// The avatar route only needs a logged-in user (any role can set
// their own picture).
router.post("/me/avatar", (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({ error: "Photo is too big (max 2 MB)" });
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
    next();
  });
}, c.uploadAvatar);

// Admin user management.
router.get("/", authorize("admin"), c.list);
router.post("/", authorize("admin"), c.create);
router.put("/:id", authorize("admin"), c.update);
router.delete("/:id", authorize("admin"), c.remove);

module.exports = router;
