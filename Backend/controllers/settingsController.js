// controllers/settingsController.js
// Read and update the single settings document.

const fs = require("fs");
const path = require("path");
const Settings = require("../models/Settings");

// Where uploaded logo files live (relative to this folder's parent).
const uploadsDir = path.join(__dirname, "..", "uploads");

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

// POST /api/settings/logo
// Uploads a logo image and stores its URL in the settings document.
// Admin only (route level). The route layer already checked that
// req.file exists and is a real image under 2 MB (in memory).
async function uploadLogo(req, res) {
  // Map the mime type to a file extension, so the browser can
  // display it when served back from /uploads.
  const extByMime = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/svg+xml": ".svg",
  };
  const ext = extByMime[req.file.mimetype] || ".png";
  const filename = "logo-" + Date.now() + ext;

  // Make sure the uploads folder exists before writing into it.
  fs.mkdirSync(uploadsDir, { recursive: true });

  // Replace the old logo file if there was one.
  const s = await Settings.findOne() || (await Settings.create({}));
  const old = s.logo;
  if (old && old.startsWith("/uploads/")) {
    const oldPath = path.join(uploadsDir, path.basename(old));
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  fs.writeFileSync(path.join(uploadsDir, filename), req.file.buffer);
  s.logo = "/uploads/" + filename;
  await s.save();
  res.json(s);
}

module.exports = { get, update, uploadLogo };
