// models/Sale.js
// One completed transaction: the items sold, the money,
// and the payment details. The heart of the POS system.

const mongoose = require("mongoose");

// A single line inside a sale: one product and a quantity.
// Prices and names are copied from the product at sale time,
// so the receipt stays correct even if the product changes later.
const saleItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  name: { type: String, required: true }, // snapshot of product name
  price: { type: Number, required: true, min: 0 }, // snapshot of sale price
  quantity: { type: Number, required: true, min: 1 },
  lineTotal: { type: Number, required: true, min: 0 }, // price * quantity
});

const saleSchema = new mongoose.Schema(
  {
    invoiceNo: {
      type: String,
      required: true,
      unique: true,
      index: true, // fast lookup by invoice number
    },
    items: {
      type: [saleItemSchema],
      validate: (v) => v.length > 0, // a sale must have at least one item
    },
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 }, // total discount amount
    tax: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    paymentMethod: {
      type: String,
      required: true,
      enum: ["cash", "card"],
    },
    cashReceived: { type: Number, default: 0, min: 0 },
    balance: { type: Number, default: 0, min: 0 }, // change owed to customer
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null, // walk-in sales have no customer
    },
    cashier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["completed", "cancelled", "refunded"],
      default: "completed",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Sale", saleSchema);
