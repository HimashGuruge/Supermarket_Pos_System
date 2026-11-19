// models/Return.js
// A refund: items coming back from a sale.
// Restores stock and records how much money went back.

const mongoose = require("mongoose");

const returnItemSchema = new mongoose.Schema({
  saleItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Sale",
    required: true,
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  name: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  refundPerUnit: { type: Number, required: true, min: 0 },
});

const returnSchema = new mongoose.Schema(
  {
    sale: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sale",
      required: true,
    },
    items: {
      type: [returnItemSchema],
      validate: (v) => v.length > 0,
    },
    refundAmount: { type: Number, required: true, min: 0 },
    reason: { type: String, default: "" },
    handledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Return", returnSchema);
