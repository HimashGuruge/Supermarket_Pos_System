// controllers/purchaseController.js
// Stock coming IN: the store buys from a supplier.
// Receiving a purchase adds stock to each product,
// and records a StockMovement per line.

const mongoose = require("mongoose");
const Purchase = require("../models/Purchase");
const Supplier = require("../models/Supplier");
const Product = require("../models/Product");
const StockMovement = require("../models/StockMovement");
const Notification = require("../models/Notification");

// Thrown inside the transaction when a purchase is invalid. Carries an
// HTTP status so the catch block can answer with the right code.
class PurchaseError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Make a purchase number like "PUR-20261118-0001".
// The count runs INSIDE the transaction, so the number is unique
// against what this transaction has written.
async function nextInvoiceNo(session) {
  const d = new Date();
  const dateStr =
    d.getFullYear() +
    String(d.getMonth() + 1).padStart(2, "0") +
    String(d.getDate()).padStart(2, "0");
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const opts = session ? { session } : {};
  const count = await Purchase.countDocuments(
    { createdAt: { $gte: start } },
    opts
  );
  return "PUR-" + dateStr + "-" + String(count + 1).padStart(4, "0");
}

// POST /api/purchases
// Body: { supplier: <id>, items: [{ product, quantity, costPerUnit }],
//         paidAmount, notes }
//
// The cost per unit comes from the client (what was actually paid to
// the supplier), falling back to the product's stored purchasePrice
// when the client sends none. Stock goes UP for each item and a
// StockMovement is logged per line.
//
// Everything runs in ONE transaction: the purchase document, the stock
// increments and the movements commit together or roll back together,
// so stock is never added without the purchase record (or vice versa).
async function create(req, res) {
  const { supplier, items, paidAmount = 0, notes = "" } = req.body;

  if (!supplier || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "Supplier and at least one item are required" });
    return;
  }

  const session = await mongoose.startSession();
  try {
    const purchase = await session.withTransaction(
      async () => {
        // findOne(conditions, projection, options): pass null for the
        // projection, because the 2nd positional arg is NOT options.
        const sup = await Supplier.findOne({ _id: supplier }, null, { session });
        if (!sup) {
          throw new PurchaseError(400, "Supplier not found");
        }

        // Load products and check each one still exists.
        const ids = items.map((i) => i.product);
        const products = await Product.find({ _id: { $in: ids } }, null, { session });
        if (products.length !== ids.length) {
          throw new PurchaseError(400, "A product no longer exists");
        }

        const purchaseItems = [];
        let total = 0;
        for (const it of items) {
          if (!Number.isInteger(it.quantity) || it.quantity < 1) {
            throw new PurchaseError(
              400,
              "Purchase quantities must be whole numbers of 1 or more"
            );
          }
          const p = products.find(
            (x) => String(x._id) === String(it.product)
          );
          // Trust the client's cost when it is a valid number;
          // otherwise fall back to the product's purchasePrice.
          const cost =
            Number.isFinite(it.costPerUnit) && it.costPerUnit >= 0
              ? it.costPerUnit
              : p ? p.purchasePrice : 0;
          const lineTotal = cost * it.quantity;
          total += lineTotal;
          purchaseItems.push({
            product: it.product,
            name: p ? p.name : "Unknown",
            quantity: it.quantity,
            costPerUnit: cost,
            lineTotal,
          });
        }

        // Work out the payment status from how much was paid.
        const paid = Math.min(Math.max(paidAmount, 0), total);
        const paymentStatus =
          paid >= total ? "paid" : paid > 0 ? "partial" : "unpaid";

        const invoiceNo = await nextInvoiceNo(session);
        // Destructure the array: await the Promise, then take [0].
        // (await create(...)[0] would index the Promise, not the array.)
        const [purchase] = await Purchase.create(
          [
            {
              invoiceNo,
              supplier,
              items: purchaseItems,
              total,
              paidAmount: paid,
              paymentStatus,
              received: true,
              notes,
            },
          ],
          { session }
        );

        // Add stock to each product and log the movement.
        for (const it of purchaseItems) {
          await Product.updateOne(
            { _id: it.product },
            { $inc: { stock: it.quantity } },
            { session }
          );
          await StockMovement.create(
            [
              {
                product: it.product,
                type: "in",
                quantity: it.quantity,
                reason: "Purchase " + invoiceNo,
                reference: invoiceNo,
                doneBy: req.userId,
              },
            ],
            { session }
          );
        }

        return purchase;
      },
      { readConcern: { level: "local" }, writeConcern: { w: "majority" } }
    );

    // Best-effort log entry (outside the transaction).
    await Notification.create({
      type: "purchase",
      message:
        "Purchase " +
        purchase.invoiceNo +
        " received (LKR " +
        purchase.total.toFixed(2) +
        ")",
    }).catch(() => {});

    res.status(201).json(purchase);
  } catch (err) {
    if (err instanceof PurchaseError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error("Purchase failed:", err && err.message);
    res.status(500).json({ error: "Purchase failed, please try again" });
  } finally {
    await session.endSession();
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
