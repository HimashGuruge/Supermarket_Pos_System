// controllers/purchaseController.js
// Stock coming IN: the store buys from a supplier.
// Receiving a purchase adds stock to each product,
// and records a StockMovement per line.

const Purchase = require("../models/Purchase");
const Supplier = require("../models/Supplier");
const Product = require("../models/Product");
const StockMovement = require("../models/StockMovement");
const Notification = require("../models/Notification");

// Make a purchase number like "PUR-20261118-0001".
async function nextInvoiceNo() {
  const d = new Date();
  const dateStr =
    d.getFullYear() +
    String(d.getMonth() + 1).padStart(2, "0") +
    String(d.getDate()).padStart(2, "0");
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const count = await Purchase.countDocuments({ createdAt: { $gte: start } });
  return "PUR-" + dateStr + "-" + String(count + 1).padStart(4, "0");
}

// POST /api/purchases
// Body: { supplier: <id>, items: [{ product, quantity, costPerUnit }],
//         paidAmount, notes }
// Stock goes UP for each item (a simple increment), movement is logged.
// No transaction needed: increments can never make stock negative,
// and a failed request just leaves the stock it already added.
async function create(req, res) {
  const { supplier, items, paidAmount = 0, notes = "" } = req.body;

  if (!supplier || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "Supplier and at least one item are required" });
    return;
  }

  try {
    const sup = await Supplier.findById(supplier);
    if (!sup) {
      res.status(400).json({ error: "Supplier not found" });
      return;
    }

    // Load products and check each one still exists.
    const ids = items.map((i) => i.product);
    const products = await Product.find({ _id: { $in: ids } });
    if (products.length !== ids.length) {
      res.status(400).json({ error: "A product no longer exists" });
      return;
    }

    const purchaseItems = [];
    let total = 0;
    for (const it of items) {
      const p = products.find((x) => String(x._id) === String(it.product));
      const lineTotal = p ? p.purchasePrice * it.quantity : 0;
      total += lineTotal;
      purchaseItems.push({
        product: it.product,
        name: p ? p.name : "Unknown",
        quantity: it.quantity,
        costPerUnit: p ? p.purchasePrice : 0,
        lineTotal,
      });
    }

    // Work out the payment status from how much was paid.
    const paid = Math.min(Math.max(paidAmount, 0), total);
    const paymentStatus =
      paid >= total ? "paid" : paid > 0 ? "partial" : "unpaid";

    const invoiceNo = await nextInvoiceNo();
    const purchase = await Purchase.create({
      invoiceNo,
      supplier,
      items: purchaseItems,
      total,
      paidAmount: paid,
      paymentStatus,
      received: true,
      notes,
    });

    // Add stock to each product and log the movement.
    for (const it of items) {
      await Product.updateOne(
        { _id: it.product },
        { $inc: { stock: it.quantity } }
      );
      await StockMovement.create({
        product: it.product,
        type: "in",
        quantity: it.quantity,
        reason: "Purchase " + invoiceNo,
        reference: invoiceNo,
        doneBy: req.userId,
      });
    }

    // Best-effort log entry.
    await Notification.create({
      type: "purchase",
      message:
        "Purchase " + invoiceNo + " received (LKR " + total.toFixed(2) + ")",
    });

    res.status(201).json(purchase);
  } catch (err) {
    console.error("Purchase failed:", err && err.message);
    res.status(500).json({ error: "Purchase failed, please try again" });
  }
}

// GET /api/purchases  — newest first, with supplier names.
async function list(req, res) {
  const purchases = await Purchase.find()
    .sort({ createdAt: -1 })
    .limit(200)
    .populate("supplier", "name");
  res.json(purchases);
}

// GET /api/purchases/:id
async function getOne(req, res) {
  const p = await Purchase.findById(req.params.id).populate(
    "supplier",
    "name"
  );
  if (!p) {
    res.status(404).json({ error: "Purchase not found" });
    return;
  }
  res.json(p);
}

module.exports = { create, list, getOne };
