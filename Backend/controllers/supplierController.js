// controllers/supplierController.js
// Read-only list of suppliers. The purchase form uses this to
// fill its supplier dropdown. (Full supplier CRUD is a later phase.)

const Supplier = require("../models/Supplier");

// GET /api/suppliers — all suppliers, newest first by name.
async function list(req, res) {
  const suppliers = await Supplier.find().sort({ name: 1 });
  res.json(suppliers);
}

// GET /api/suppliers/:id — one supplier.
async function getOne(req, res) {
  const s = await Supplier.findById(req.params.id);
  if (!s) {
    res.status(404).json({ error: "Supplier not found" });
    return;
  }
  res.json(s);
}

module.exports = { list, getOne };
