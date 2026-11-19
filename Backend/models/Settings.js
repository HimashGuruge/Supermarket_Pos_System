// models/Settings.js
// Store-wide settings: name, address, currency, tax rate, etc.
// There is always exactly ONE settings document in the database
// (id 1). The app reads it once and caches it in memory.

const mongoose = require("mongoose");

const settingsSchema = new mongoose.Schema({
  storeName: { type: String, default: "Supermart" },
  logo: { type: String, default: "" }, // image URL or path
  address: { type: String, default: "" },
  phone: { type: String, default: "" },
  currency: { type: String, default: "LKR" }, // money symbol/unit
  taxRate: { type: Number, default: 0, min: 0, max: 100 }, // percent, 0 = off
  discountDefault: { type: Number, default: 0, min: 0, max: 100 },
  receiptFooter: { type: String, default: "Thank you for shopping!" },
  lowStockThreshold: { type: Number, default: 5, min: 0 },
});

module.exports = mongoose.model("Settings", settingsSchema);
