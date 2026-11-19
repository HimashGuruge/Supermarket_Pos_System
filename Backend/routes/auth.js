// routes/auth.js
// The two login-related URLs.

const express = require("express");
const { login, me } = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// POST /api/auth/login  — no auth needed, that is what it gives you.
router.post("/login", login);

// GET /api/auth/me  — needs a valid token to answer.
router.get("/me", requireAuth, me);

module.exports = router;
