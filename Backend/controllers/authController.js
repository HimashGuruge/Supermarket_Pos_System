// controllers/authController.js
// Handles login and checking who is logged in.

const User = require("../models/User");
const { signToken } = require("../middleware/auth");

// POST /api/auth/login
// Body: { email, password }
// Checks the email + password. If they match, returns a JWT token
// and the user (without the password). If not, a 401.
async function login(req, res) {
  const { email, password } = req.body;

  // Find the user by email.
  const user = await User.findOne({ email: (email || "").toLowerCase() });
  if (!user) {
    res.status(401).json({ error: "Wrong email or password" });
    return;
  }

  // Compare the typed password to the stored hash.
  const ok = await user.comparePassword(password || "");
  if (!ok) {
    res.status(401).json({ error: "Wrong email or password" });
    return;
  }

  // Both checks passed — make a token and send it with the user.
  const token = signToken(user);
  res.json({ token, user: user.toSafe() });
}

// GET /api/auth/me
// Uses the JWT to find the user and send them back,
// so the frontend can show the logged-in person's name and role.
async function me(req, res) {
  const user = await User.findById(req.userId);
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }
  res.json({ user: user.toSafe() });
}

module.exports = { login, me };
