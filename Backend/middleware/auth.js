// middleware/auth.js
// Verifies the JWT token on every protected request.
//
// How it works:
//   1. The frontend sends "Authorization: Bearer <token>" on each request.
//   2. This middleware reads that token and checks it with the secret.
//   3. If it is valid, we attach the user's id to the request object
//      so controllers can use it. If not, we send a 401 "not logged in".

const jwt = require("jsonwebtoken");
require("dotenv").config();

// The secret comes from .env. index.js refuses to start when it is
// missing, so this is always a real value, never a fallback.
const SECRET = process.env.JWT_SECRET;

// The middleware function Express calls for every protected route.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";

  // Tokens are sent as "Bearer <token>". Take the part after "Bearer ".
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!token) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }

  // Verify the token signature and that it is not expired.
  try {
    const decoded = jwt.verify(token, SECRET);
    req.userId = decoded.userId; // attach the logged-in user id
    req.userRole = decoded.role; // and their role, for quick checks
    next(); // continue to the next function (the route handler)
  } catch (err) {
    res.status(401).json({ error: "Session expired, please log in again" });
  }
}

// Helper for making tokens, used by the login controller.
function signToken(user) {
  // Expires in 12 hours, so cashiers do not log in again mid-shift.
  return jwt.sign({ userId: user._id, role: user.role }, SECRET, {
    expiresIn: "12h",
  });
}

module.exports = { requireAuth, signToken };
