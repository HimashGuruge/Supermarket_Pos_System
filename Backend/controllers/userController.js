// controllers/userController.js
// Admin manages the people who can log in.

const User = require("../models/User");

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

module.exports = { list, create, update, remove };
