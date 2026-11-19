// models/Notification.js
// A small message for the user: low stock, product expiring,
// sale completed, purchase recorded, etc.

const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        "low_stock",
        "expiry",
        "sale",
        "purchase",
        "return",
        "system",
      ],
      required: true,
    },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", notificationSchema);
