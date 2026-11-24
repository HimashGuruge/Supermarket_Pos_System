// controllers/saleController.js
// The heart of the POS. One POST creates a sale:
//
//   1. Loads every product in the cart.
//   2. Inside ONE MongoDB transaction: reduces each product's stock
//      with an atomic check-and-decrement ("only subtract if stock is
//      high enough" — two sales racing for the last item can never
//      both succeed), writes a StockMovement per item, and saves the
//      Sale document.
//   3. If ANY of those steps fails — or the server crashes mid-way —
//      the whole transaction rolls back: stock, logs, and the sale
//      commit together or not at all. Nothing is ever lost.
//   4. Emits a Socket.IO event so the dashboard updates live.

const mongoose = require("mongoose");
const Sale = require("../models/Sale");
const Product = require("../models/Product");
const Purchase = require("../models/Purchase");
const StockMovement = require("../models/StockMovement");
const Notification = require("../models/Notification");
const Settings = require("../models/Settings");
const Return = require("../models/Return");

// Build an invoice number like "INV-20261118-0012".
// The date part is today's date; the number is how many sales
// exist today plus one.
async function nextInvoiceNo(session) {
  const d = new Date();
  const dateStr =
    d.getFullYear() +
    String(d.getMonth() + 1).padStart(2, "0") +
    String(d.getDate()).padStart(2, "0");

  // Count sales made today (createdAt between midnight and now).
  // The count runs INSIDE the same transaction, so it only sees
  // what this transaction has written.
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const opts = session ? { session } : {};
  const count = await Sale.countDocuments(
    { createdAt: { $gte: start } },
    opts
  );
  return "INV-" + dateStr + "-" + String(count + 1).padStart(4, "0");
}

// Thrown INSIDE the transaction when stock runs short. Catching it
// outside means the transaction is aborted (rolled back) and the
// client gets a 409 with a clear message.
class StockShortage extends Error {}

// POST /api/sales
// Body: {
//   items: [{ product: <id>, quantity: <n> }],
//   discount: <number>,        // LKR amount, capped at the subtotal
//   paymentMethod: "cash" | "card",
//   cashReceived: <number>,    // for cash: must be at least the total
//   customer: <id or null>
// }
// NOTE: the client's taxRate is IGNORED on purpose. The server reads
// the tax rate from the store Settings itself, so a direct API call
// cannot remove or change the tax.
async function create(req, res, io) {
  const { items, discount = 0, paymentMethod, cashReceived = 0, customer } = req.body;
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

  // Every line must have a product and a whole quantity of 1 or more.
  // (A negative quantity would INCREASE stock — that must be blocked.)
  for (const it of items) {
    if (!it.product) {
      res.status(400).json({ error: "Every cart line needs a product" });
      return;
    }
    if (!Number.isInteger(it.quantity) || it.quantity < 1) {
      res.status(400).json({ error: "Quantities must be whole numbers of 1 or more" });
      return;
    }
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

    // Step 2: check the discount, then calculate the money.
    // lineTotal for each item, subtotal, tax, and final total.
    // The tax rate is read from the store Settings — the client's
    // taxRate is ignored, so a direct API call cannot remove the tax.
    if (typeof discount !== "number" || isNaN(discount) || discount < 0) {
      res.status(400).json({ error: "Discount must be zero or a positive amount" });
      return;
    }

    // Cost snapshot: what each unit cost the store, so profit can be
    // computed later from ACTUAL cost, not the current price. We use
    // the cost from the LATEST received purchase for that product, and
    // fall back to the product's purchasePrice when there is none.
    const costByProduct = {};
    const costLines = await Purchase.find({
      received: true,
      "items.product": { $in: ids },
    })
      .sort({ createdAt: 1 }) // oldest first, so the newest wins below
      .lean();
    for (const pc of costLines) {
      for (const li of pc.items) {
        // Only keep the newest received cost per product.
        costByProduct[String(li.product)] = li.costPerUnit;
      }
    }

    let subtotal = 0;
    const saleItems = items.map((it) => {
      const p = products.find((x) => String(x._id) === String(it.product));
      const lineTotal = p.salePrice * it.quantity;
      subtotal += lineTotal;
      const cost =
        costByProduct[String(p._id)] != null
          ? costByProduct[String(p._id)]
          : p.purchasePrice;
      return {
        product: p._id,
        name: p.name,
        price: p.salePrice,
        costPerUnit: cost,
        quantity: it.quantity,
        lineTotal,
      };
    });
    // A discount can never be bigger than the subtotal.
    if (discount > subtotal) {
      res.status(400).json({ error: "Discount cannot be more than the subtotal" });
      return;
    }
    const settings = await Settings.findOne();
    const taxRate = settings ? settings.taxRate || 0 : 0;
    const tax = ((subtotal - discount) * taxRate) / 100;
    const total = subtotal - discount + tax;

    // Step 3: cash checks and the change due.
    // For cash, the money handed over must cover the total —
    // underpayment is refused, not silently accepted.
    if (paymentMethod === "cash") {
      if (typeof cashReceived !== "number" || isNaN(cashReceived)) {
        res.status(400).json({ error: "Cash received must be a number" });
        return;
      }
      if (cashReceived < total) {
        res.status(400).json({
          error:
            "Cash received (" +
            cashReceived.toFixed(2) +
            ") is less than the total (" +
            total.toFixed(2) +
            ")",
        });
        return;
      }
    }
    // Change owed back to the customer. Card has no change.
    const balance = paymentMethod === "cash" ? cashReceived - total : 0;

    // Steps 4-6 run inside ONE MongoDB transaction:
    // stock decrements, stock logs, and the Sale document commit
    // together — or roll back together. A crash in the middle of a
    // sale can never leave half a sale behind.
    const lowStock = []; // low-stock drops found inside the transaction
    const session = await mongoose.startSession();
    try {
      const sale = await session.withTransaction(
        async () => {
          // Step 4: build the invoice number (unique per sale).
          const invoiceNo = await nextInvoiceNo(session);

          // Step 5: reduce stock atomically, one item at a time.
          // "Only subtract if stock is high enough" — this check and the
          // decrement happen in one MongoDB step, so two sales racing for
          // the last item can never both succeed.
          for (const it of items) {
            const p = products.find(
              (x) => String(x._id) === String(it.product)
            );
            const result = await Product.findOneAndUpdate(
              { _id: p._id, stock: { $gte: it.quantity } }, // only if enough
              { $inc: { stock: -it.quantity } }, // subtract it
              { session, returnDocument: "after" }
            );
            if (!result) {
              // Not enough stock. Throwing aborts the whole
              // transaction — stock taken earlier is given back
              // automatically, no manual undo needed.
              throw new StockShortage(p.name);
            }

            // Record the stock movement.
            // Mongoose needs an ARRAY as the first argument when a
            // session is passed — then { session } is read as options.
            await StockMovement.create(
              [
                {
                  product: p._id,
                  type: "out",
                  quantity: it.quantity,
                  reason: "Sale " + invoiceNo,
                  reference: invoiceNo,
                  doneBy: cashier,
                },
              ],
              { session }
            );

            // Low-stock check: remember it here, create the
            // notification AFTER the commit — a rolled-back sale
            // must never leave a notification behind.
            const left = result.stock;
            if (left <= p.minStock) {
              lowStock.push({ name: p.name, left, min: p.minStock });
            }
          }

          // Step 6: save the Sale document.
          // Same array rule; create() returns an array, so take
          // the first (only) element.
          const [saved] = await Sale.create(
            [
              {
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
              },
            ],
            { session }
          );
          return saved;
        },
        {
          readConcern: { level: "local" },
          writeConcern: { w: "majority" },
        }
      );

      // The transaction committed. These side effects are best-effort:
      // if they fail, they must never undo the sale.
      for (const ls of lowStock) {
        await Notification.create({
          type: "low_stock",
          message:
            "Low stock: " +
            ls.name +
            " has " +
            ls.left +
            " left (min " +
            ls.min +
            ")",
        }).catch(() => {});
      }
      await Notification.create({
        type: "sale",
        message:
          "Sale " +
          sale.invoiceNo +
          " completed (LKR " +
          sale.total.toFixed(2) +
          ")",
      }).catch(() => {});

      // Step 7: tell every connected dashboard to refresh, via Socket.IO.
      if (io) io.emit("sale-created", { invoiceNo: sale.invoiceNo, total: sale.total });

      res.status(201).json(sale);
    } finally {
      // Release the session back to the pool, on every path.
      await session.endSession();
    }
  } catch (err) {
    // Stock ran short inside the transaction. The transaction was
    // aborted (rolled back), so read the real stock now for the
    // message.
    if (err instanceof StockShortage) {
      const p = await Product.findOne({ name: err.message });
      res.status(409).json({
        error:
          "Not enough stock for " +
          err.message +
          " (have " +
          (p ? p.stock : "?") +
          ")",
      });
      return;
    }
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
// Only admin or stock can cancel.
// IMPORTANT: a RETURN already gave its items' stock back. Cancelling
// the sale must not give those units back again, or stock would be
// restored twice. We restore only what was never returned.
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

  // The status change and every stock restore commit together in ONE
  // transaction. A crash mid-cancel rolls back completely, so the sale
  // is never left "cancelled" with its stock still taken (or vice versa).
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(
      async () => {
        sale.status = "cancelled";
        await sale.save({ session });

        // Count how many units of each product came back through returns.
        // find(conditions, projection, options): session goes in the
        // 3rd arg — the 2nd arg is the projection.
        const returns = await Return.find({ sale: sale._id }, null, { session });
        const returnedByProduct = {};
        for (const r of returns) {
          for (const it of r.items) {
            const key = String(it.product);
            returnedByProduct[key] = (returnedByProduct[key] || 0) + it.quantity;
          }
        }

        // Give each item's stock back — only the part that was NOT
        // already restored by a return.
        for (const it of sale.items) {
          const key = String(it.product);
          const alreadyBack = Math.min(
            returnedByProduct[key] || 0,
            it.quantity
          );
          const toRestore = it.quantity - alreadyBack;
          if (toRestore <= 0) continue; // fully returned — nothing left

          await Product.updateOne(
            { _id: it.product },
            { $inc: { stock: toRestore } },
            { session }
          );
          await StockMovement.create(
            [
              {
                product: it.product,
                type: "in",
                quantity: toRestore,
                reason: "Cancelled " + sale.invoiceNo,
                reference: sale.invoiceNo,
                doneBy: req.userId,
              },
            ],
            { session }
          );
        }
      },
      { readConcern: { level: "local" }, writeConcern: { w: "majority" } }
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("Cancel failed:", err && err.message);
    res.status(500).json({ error: "Cancel failed, please try again" });
  } finally {
    await session.endSession();
  }
}

module.exports = { create, list, getOne, cancel };
