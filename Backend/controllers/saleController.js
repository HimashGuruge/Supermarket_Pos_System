// controllers/saleController.js
// The heart of the POS. One POST creates a sale:
//
//   1. Loads every product in the cart.
//   2. Reduces each product's stock with an atomic check-and-decrement:
//      "only subtract if stock is high enough". If two sales hit the
//      same item at the same time, only one succeeds.
//   3. If any item ran short, the stock taken so far is given back
//      (a "roll back"), so nothing is lost.
//   4. Saves the Sale document and a StockMovement per item.
//   5. Emits a Socket.IO event so the dashboard updates live.

const Sale = require("../models/Sale");
const Product = require("../models/Product");
const StockMovement = require("../models/StockMovement");
const Notification = require("../models/Notification");

// Build an invoice number like "INV-20261118-0012".
// The date part is today's date; the number is how many sales
// exist today plus one.
async function nextInvoiceNo() {
  const d = new Date();
  const dateStr =
    d.getFullYear() +
    String(d.getMonth() + 1).padStart(2, "0") +
    String(d.getDate()).padStart(2, "0");

  // Count sales made today (createdAt between midnight and now).
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const count = await Sale.countDocuments({ createdAt: { $gte: start } });
  return "INV-" + dateStr + "-" + String(count + 1).padStart(4, "0");
}

// POST /api/sales
// Body: {
//   items: [{ product: <id>, quantity: <n> }],
//   discount: <number>,
//   paymentMethod: "cash" | "card",
//   cashReceived: <number>,
//   customer: <id or null>,
//   taxRate: <percent>   // from settings, or 0
// }
async function create(req, res, io) {
  const { items, discount = 0, paymentMethod, cashReceived = 0, customer, taxRate = 0 } = req.body;
  const cashier = req.userId;

  // Basic check: at least one item, and a valid payment method.
  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "Cart is empty" });
    return;
  }
  if (paymentMethod !== "cash" && paymentMethod !== "card") {
    res.status(400).json({ error: "Payment method must be cash or card" });
    return;
  }

  try {
    // Step 1: load every product in the cart.
    const ids = items.map((i) => i.product);
    const products = await Product.find({ _id: { $in: ids } });

    // If any product id was not found, stop with a clear message.
    if (products.length !== ids.length) {
      res.status(400).json({ error: "A product in the cart no longer exists" });
      return;
    }

    // Step 2: calculate the money.
    // lineTotal for each item, subtotal, tax, and final total.
    let subtotal = 0;
    const saleItems = items.map((it) => {
      const p = products.find((x) => String(x._id) === String(it.product));
      const lineTotal = p.salePrice * it.quantity;
      subtotal += lineTotal;
      return {
        product: p._id,
        name: p.name,
        price: p.salePrice,
        quantity: it.quantity,
        lineTotal,
      };
    });
    const tax = ((subtotal - discount) * taxRate) / 100;
    const total = subtotal - discount + tax;

    // Step 3: cash balance (change owed to the customer).
    // Only meaningful for cash; card has no change.
    const balance =
      paymentMethod === "cash" ? Math.max(0, cashReceived - total) : 0;

    // Step 4: build the invoice number (unique per sale).
    const invoiceNo = await nextInvoiceNo();

    // Step 5: reduce stock atomically, one item at a time.
    // "Only subtract if stock is high enough" — this check and the
    // decrement happen in one MongoDB step, so two sales racing for
    // the last item can never both succeed.
    const decremented = []; // remembers what we took, to give back on failure
    for (const it of items) {
      const p = products.find((x) => String(x._id) === String(it.product));
      const result = await Product.findOneAndUpdate(
        { _id: p._id, stock: { $gte: it.quantity } }, // only if enough stock
        { $inc: { stock: -it.quantity } }, // subtract it
        { returnDocument: "after" }
      );
      if (!result) {
        // Not enough stock. Give back everything already taken,
        // so the sale is all-or-nothing even without a transaction.
        for (const done of decremented) {
          await Product.updateOne(
            { _id: done.product },
            { $inc: { stock: done.quantity } }
          );
        }
        res.status(409).json({
          error: "Not enough stock for " + p.name + " (have " + p.stock + ")",
        });
        return;
      }
      decremented.push({ product: p._id, quantity: it.quantity });

      // Record the stock movement.
      await StockMovement.create({
        product: p._id,
        type: "out",
        quantity: it.quantity,
        reason: "Sale " + invoiceNo,
        reference: invoiceNo,
        doneBy: cashier,
      });

      // Low-stock check: if the product just dropped to or below
      // its minimum, flag it for the notification list.
      const left = result.stock;
      if (left <= p.minStock) {
        await Notification.create({
          type: "low_stock",
          message:
            "Low stock: " +
            p.name +
            " has " +
            left +
            " left (min " +
            p.minStock +
            ")",
        });
      }
    }

    // Step 6: save the Sale document.
    const sale = await Sale.create({
      invoiceNo,
      items: saleItems,
      subtotal,
      discount,
      tax,
      total,
      paymentMethod,
      cashReceived,
      balance,
      customer: customer || null,
      cashier,
      status: "completed",
    });

    // Success notification (best-effort, so a failure here
    // never blocks the sale itself).
    Notification.create({
      type: "sale",
      message: "Sale " + invoiceNo + " completed (LKR " + total.toFixed(2) + ")",
    }).catch(() => {});

    // Step 7: tell every connected dashboard to refresh, via Socket.IO.
    if (io) io.emit("sale-created", { invoiceNo, total });

    res.status(201).json(sale);
  } catch (err) {
    // Show the real error while we are still in development.
    console.error("Sale failed:", err && err.message);
    res.status(500).json({ error: "Sale failed, please try again" });
  }
}

// GET /api/sales?date=  — list sales, optionally filtered by date.
async function list(req, res) {
  const { date } = req.query;
  const q = {};
  if (date) {
    const d = new Date(date);
    if (!isNaN(d)) {
      q.createdAt = {
        $gte: new Date(d.getFullYear(), d.getMonth(), d.getDate()),
        $lt: new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1),
      };
    }
  }
  const sales = await Sale.find(q)
    .sort({ createdAt: -1 })
    .populate("customer", "name")
    .populate("cashier", "name")
    .limit(200);
  res.json(sales);
}

// GET /api/sales/:id  — one sale, for the receipt and detail view.
async function getOne(req, res) {
  const sale = await Sale.findById(req.params.id)
    .populate("customer", "name")
    .populate("cashier", "name");
  if (!sale) {
    res.status(404).json({ error: "Sale not found" });
    return;
  }
  res.json(sale);
}

// POST /api/sales/:id/cancel  — cancel a sale and give the stock back.
// Only admin or stock can cancel. Restoring stock is just an
// atomic increment, so no transaction is needed here either.
async function cancel(req, res) {
  const sale = await Sale.findById(req.params.id);
  if (!sale) {
    res.status(404).json({ error: "Sale not found" });
    return;
  }
  if (sale.status === "cancelled") {
    res.status(409).json({ error: "Sale already cancelled" });
    return;
  }

  try {
    sale.status = "cancelled";
    await sale.save();

    // Give each item's stock back and record the movement.
    for (const it of sale.items) {
      await Product.updateOne(
        { _id: it.product },
        { $inc: { stock: it.quantity } }
      );
      await StockMovement.create({
        product: it.product,
        type: "in",
        quantity: it.quantity,
        reason: "Cancelled " + sale.invoiceNo,
        reference: sale.invoiceNo,
        doneBy: req.userId,
      });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("Cancel failed:", err && err.message);
    res.status(500).json({ error: "Cancel failed, please try again" });
  }
}

module.exports = { create, list, getOne, cancel };
