// controllers/categoryController.js
// CRUD for product categories.

const Category = require("../models/Category");
const Product = require("../models/Product");

// GET /api/categories
async function list(req, res) {
  const categories = await Category.find().sort({ name: 1 });
  res.json(categories);
}

// POST /api/categories
async function create(req, res) {
  const c = await Category.create(req.body);
  res.status(201).json(c);
}

// PUT /api/categories/:id
async function update(req, res) {
  const c = await Category.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!c) {
    res.status(404).json({ error: "Category not found" });
    return;
  }
  res.json(c);
}

// DELETE /api/categories/:id
// Refuses to delete a category that still has products in it,
// so a product never loses its group without someone checking.
async function remove(req, res) {
  const count = await Product.countDocuments({
    category: req.params.id,
  });
  if (count > 0) {
    res.status(409).json({
      error: "Category still has " + count + " products",
    });
    return;
  }
  await Category.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
}

module.exports = { list, create, update, remove };
