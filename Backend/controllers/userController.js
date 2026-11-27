// controllers/userController.js
// Admin manages the people who can log in.

const fs = require("fs");
const path = require("path");
const User = require("../models/User");

// Where uploaded avatar files live (relative to this folder's parent).
const uploadsDir = path.join(__dirname, "..", "uploads");

// Map a mime type to a file extension so the browser can display it.
const extByMime = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
};

// POST /api/users/me/avatar
// Uploads the logged-in user's profile picture. The file is named
// after the user id, so each upload overwrites the previous one and
// no old avatar files pile up.
async function uploadAvatar(req, res) {
  const userId = req.userId;
  const ext = extByMime[req.file.mimetype] || ".png";
  const filename = "avatar-" + userId + ext;

  fs.mkdirSync(uploadsDir, { recursive: true });

  // Delete the old avatar file if there was one.
  const u = await User.findById(userId);
  if (!u) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const old = u.avatar;
  if (old && old.startsWith("/uploads/")) {
    const oldPath = path.join(uploadsDir, path.basename(old));
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  fs.writeFileSync(path.join(uploadsDir, filename), req.file.buffer);
  u.avatar = "/uploads/" + filename;
  await u.save();
  res.json(u.toSafe());
}

// GET /api/users
async function list(req, res) {
  const users = await User.find().sort({ name: 1 });
  const safe = users.map((u) => u.toSafe());
  res.json(safe);
}

// POST /api/users
async function create(req, res) {
  const u = await User.create(req.body);
  res.status(201).json(u.toSafe());
}

// PUT /api/users/:id
// If a password is sent, hash it here — the automatic hash hook
// only runs on .save(), not on findByIdAndUpdate.
async function update(req, res) {
  const bcrypt = require("bcryptjs");
  const { password, ...rest } = req.body;
  if (password) rest.password = await bcrypt.hash(password, 10);
  const u = await User.findByIdAndUpdate(req.params.id, rest, {
    new: true,
    runValidators: true,
  });
  if (!u) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(u.toSafe());
}

// DELETE /api/users/:id
async function remove(req, res) {
  // Prevent deleting yourself, so an admin never locks themselves out.
  if (String(req.params.id) === String(req.userId)) {
    res.status(409).json({ error: "You cannot delete your own account" });
    return;
  }
  await User.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
}

module.exports = { list, create, update, remove, uploadAvatar };
