// models/Product.js
// A supermarket product: what is sold, how much it costs,
// how many are left in stock, and when it expires.

const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    barcode: {
      type: String,
      required: true,
      unique: true,
      index: true, // fast barcode scanning lookups
      trim: true,
    },
    sku: { type: String, default: "" },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    description: { type: String, default: "" },
    image: { type: String, default: "" }, // URL or path to product image
    purchasePrice: { type: Number, required: true, min: 0 }, // cost from supplier
    salePrice: { type: Number, required: true, min: 0 }, // price on the shelf
    stock: { type: Number, required: true, default: 0, min: 0 },
    minStock: {
      type: Number,
      default: 5,
      min: 0, // stock at or below this triggers a low-stock alert
    },
    expiryDate: { type: Date, default: null },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);
