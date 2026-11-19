// models/StockMovement.js
// Every change in stock is recorded here, so we can answer
// "when did stock change and why" for any product.
//
// type: "in"      = stock went up (purchase received, correction)
//       "out"     = stock went down (sale made, damage, correction)
//       "adjust"  = manual correction (counting error)
//
// The quantity is always a positive number. The sign of the
// change is shown by type + a separate "delta" field.

const mongoose = require("mongoose");

const stockMovementSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["in", "out", "adjust"],
      required: true,
    },
    quantity: { type: Number, required: true, min: 0 }, // how many units
    reason: { type: String, default: "" }, // e.g. "Sale INV-0001", "Damage"
    reference: { type: String, default: "" }, // e.g. invoice number
    doneBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("StockMovement", stockMovementSchema);
