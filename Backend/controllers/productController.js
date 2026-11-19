// controllers/productController.js
// CRUD for products. Also the endpoint the POS uses to
// look up a product by barcode or search by name.

const Product = require("../models/Product");
const Category = require("../models/Category");

// GET /api/products?search=&category=&lowStock=
// Lists products. The search box and category filter come
// in as query strings here.
async function list(req, res) {
  const { search, category, lowStock } = req.query;
  const q = {};

  // Search matches product name, barcode, or sku.
  if (search) {
    const re = new RegExp(search, "i");
    q.$or = [{ name: re }, { barcode: re }, { sku: re }];
  }
  // Filter to one category, if one was chosen.
  if (category) q.category = category;
  // Show only products at or below their minimum stock.
  if (lowStock === "true") {
    q.$expr = { $lte: ["$stock", "$minStock"] };
  }

  const products = await Product.find(q).populate("category", "name");
  res.json(products);
}

// GET /api/products/:id  — one product by its database id.
async function getOne(req, res) {
  const p = await Product.findById(req.params.id).populate("category", "name");
  if (!p) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  res.json(p);
}

// POST /api/products  — create a new product.
async function create(req, res) {
  const p = await Product.create(req.body);
  res.status(201).json(p);
}

// PUT /api/products/:id  — update one product.
async function update(req, res) {
  const p = await Product.findByIdAndUpdate(req.params.id, req.body, {
    new: true, // return the updated version
    runValidators: true,
  });
  if (!p) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  res.json(p);
}

// DELETE /api/products/:id  — remove a product.
async function remove(req, res) {
  const p = await Product.findByIdAndDelete(req.params.id);
  if (!p) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  res.json({ ok: true });
}

module.exports = { list, getOne, create, update, remove };
