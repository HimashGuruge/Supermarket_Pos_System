// controllers/customerController.js
// CRUD for registered customers.

const Customer = require("../models/Customer");
const Sale = require("../models/Sale");

// GET /api/customers?search=
async function list(req, res) {
  const { search } = req.query;
  const q = {};
  if (search) {
    const re = new RegExp(search, "i");
    q.$or = [{ name: re }, { phone: re }, { email: re }];
  }
  const customers = await Customer.find(q).sort({ name: 1 });
  res.json(customers);
}

// POST /api/customers
async function create(req, res) {
  const c = await Customer.create(req.body);
  res.status(201).json(c);
}

// PUT /api/customers/:id
async function update(req, res) {
  const c = await Customer.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!c) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }
  res.json(c);
}

// DELETE /api/customers/:id
async function remove(req, res) {
  await Customer.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
}

module.exports = { list, create, update, remove };
