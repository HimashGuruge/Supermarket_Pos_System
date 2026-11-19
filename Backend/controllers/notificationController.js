// controllers/notificationController.js
// List notifications and mark them as read.

const Notification = require("../models/Notification");

// GET /api/notifications?unread=
async function list(req, res) {
  const q = {};
  if (req.query.unread === "true") q.read = false;
  const items = await Notification.find(q).sort({ createdAt: -1 }).limit(50);
  res.json(items);
}

// POST /api/notifications/read-all
async function markAllRead(req, res) {
  await Notification.updateMany({ read: false }, { read: true });
  res.json({ ok: true });
}

// DELETE /api/notifications/:id
async function remove(req, res) {
  await Notification.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
}

module.exports = { list, markAllRead, remove };
