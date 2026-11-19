// controllers/returnController.js
// Refunds: items come back from a sale.
// Restores stock, records the money that went back,
// and marks the sale as "refunded" if every item is returned.

const Sale = require("../models/Sale");
const Return = require("../models/Return");
const Product = require("../models/Product");
const StockMovement = require("../models/StockMovement");
const Notification = require("../models/Notification");

// POST /api/returns
// Body: { sale: <saleId>, items: [{ product, quantity }], reason }
// Money back = sum of (product.salePrice * quantity).
// No transaction needed: stock only goes UP on a return, and
// the return document itself is the record of what happened.
async function create(req, res) {
  const { sale: saleId, items, reason = "" } = req.body;

  if (!saleId || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "A sale and at least one item are required" });
    return;
  }

  try {
    const sale = await Sale.findById(saleId);
    if (!sale) {
      res.status(404).json({ error: "Sale not found" });
      return;
    }

    // Work out the refund amount from the sale's own line items.
    // We trust the sale's stored prices, not the client.
    let refundAmount = 0;
    const returnItems = [];
    for (const it of items) {
      const line = sale.items.find(
        (l) => String(l.product) === String(it.product)
      );
      // Cannot return more than what was sold.
      const qty = Math.min(it.quantity, line ? line.quantity : it.quantity);
      const unitPrice = line ? line.price : 0;
      refundAmount += unitPrice * qty;
      returnItems.push({
        saleItem: line ? line._id : undefined,
        product: it.product,
        name: line ? line.name : "Unknown",
        quantity: qty,
        refundPerUnit: unitPrice,
      });
    }

    const ret = await Return.create({
      sale: saleId,
      items: returnItems,
      refundAmount,
      reason,
      handledBy: req.userId,
    });

    // Give each item's stock back and log the movement.
    for (const it of returnItems) {
      await Product.updateOne(
        { _id: it.product },
        { $inc: { stock: it.quantity } }
      );
      await StockMovement.create({
        product: it.product,
        type: "in",
        quantity: it.quantity,
        reason: "Return " + sale.invoiceNo,
        reference: sale.invoiceNo,
        doneBy: req.userId,
      });
    }

    // If every line of the sale is now fully returned,
    // mark the sale as refunded.
    const allReturned = sale.items.every((l) => {
      const line = returnItems.find(
        (r) => String(r.product) === String(l.product)
      );
      return line && line.quantity >= l.quantity;
    });
    if (allReturned) {
      sale.status = "refunded";
      await sale.save();
    }

    // Log entry.
    await Notification.create({
      type: "return",
      message:
        "Return processed for " +
        sale.invoiceNo +
        " (LKR " +
        refundAmount.toFixed(2) +
        ")",
    });

    res.status(201).json(ret);
  } catch (err) {
    console.error("Return failed:", err && err.message);
    res.status(500).json({ error: "Return failed, please try again" });
  }
}

// GET /api/returns  — newest first, with sale invoice numbers.
async function list(req, res) {
  const returns = await Return.find()
    .sort({ createdAt: -1 })
    .limit(200)
    .populate("sale", "invoiceNo");
  res.json(returns);
}

// GET /api/returns/:id
async function getOne(req, res) {
  const r = await Return.findById(req.params.id).populate("sale", "invoiceNo");
  if (!r) {
    res.status(404).json({ error: "Return not found" });
    return;
  }
  res.json(r);
}

module.exports = { create, list, getOne };
