// controllers/settingsController.js
// Read and update the single settings document.

const Settings = require("../models/Settings");

// GET /api/settings
// Returns the settings, or the defaults if none exist yet.
async function get(req, res) {
  let s = await Settings.findOne();
  if (!s) {
    // No document yet — return the model defaults so the app works.
    s = await Settings.create({});
  }
  res.json(s);
}

// PUT /api/settings
// Updates the one settings document. Admin only (route level).
async function update(req, res) {
  let s = await Settings.findOne();
  if (!s) s = await Settings.create({});
  // Merge the new values onto the existing document.
  Object.assign(s, req.body);
  await s.save();
  res.json(s);
}

module.exports = { get, update };
