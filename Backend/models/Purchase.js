// models/Purchase.js
// Stock coming IN: the store buys products from a supplier.
// When a purchase is received, product stock increases.

const mongoose = require("mongoose");

const purchaseItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  name: { type: String, required: true }, // snapshot of product name
  quantity: { type: Number, required: true, min: 1 },
  costPerUnit: { type: Number, required: true, min: 0 },
  lineTotal: { type: Number, required: true, min: 0 },
});

const purchaseSchema = new mongoose.Schema(
  {
    invoiceNo: { type: String, required: true, unique: true },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
    },
    items: {
      type: [purchaseItemSchema],
      validate: (v) => v.length > 0,
    },
    total: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, default: 0, min: 0 },
    paymentStatus: {
      type: String,
      enum: ["paid", "partial", "unpaid"],
      default: "unpaid",
    },
    received: { type: Boolean, default: true }, // received = stock added
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Purchase", purchaseSchema);
