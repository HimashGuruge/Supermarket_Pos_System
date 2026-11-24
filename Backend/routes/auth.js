// routes/auth.js
// The two login-related URLs.

const express = require("express");
const rateLimit = require("express-rate-limit");
const { login, me } = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// Brute-force guard: at most 10 login attempts per IP every 15
// minutes. A real attacker gets a clean 429, not endless guesses.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts, try again later" },
});

// POST /api/auth/login  — no auth needed, that is what it gives you.
router.post("/login", loginLimiter, login);

// GET /api/auth/me  — needs a valid token to answer.
router.get("/me", requireAuth, me);

module.exports = router;
