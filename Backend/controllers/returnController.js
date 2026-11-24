// controllers/returnController.js
// Refunds: items come back from a sale.
// Restores stock, records the money that went back,
// and marks the sale as "refunded" if every item is returned.

const mongoose = require("mongoose");
const Sale = require("../models/Sale");
const Return = require("../models/Return");
const Product = require("../models/Product");
const StockMovement = require("../models/StockMovement");
const Notification = require("../models/Notification");

// Thrown inside the transaction when a return is invalid. Carries an
// HTTP status so the catch block can answer with the right code.
class ReturnError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// POST /api/returns
// Body: { sale: <saleId>, items: [{ product, quantity }], reason }
//
// Money back = the amount actually CHARGED for the returned units.
// The sale's total (after discount and tax) is spread across its
// lines proportionally, so a refunded unit is paid back at the price
// the customer really paid — not the raw sticker price.
//
// Everything runs in ONE transaction: the return document, the stock
// restore, and the sale-status change commit together or roll back
// together. Guards:
//   - No return on a cancelled sale (its stock was already restored).
//   - No item that is not in the sale (no free stock inflation).
//   - No more units than remain: (sold − already-returned across all
//     past returns), so the same line can never be returned twice.
async function create(req, res) {
  const { sale: saleId, items, reason = "" } = req.body;

  if (!saleId || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "A sale and at least one item are required" });
    return;
  }

  const session = await mongoose.startSession();
  try {
    const { ret, invoiceNo } = await session.withTransaction(
      async () => {
        // findOne(conditions, projection, options): pass null for the
        // projection, because the 2nd positional arg is NOT options.
        const sale = await Sale.findOne({ _id: saleId }, null, { session });
        if (!sale) throw new ReturnError(404, "Sale not found");
        if (sale.status === "cancelled") {
          throw new ReturnError(
            409,
            "Cannot return items from a cancelled sale"
          );
        }

        // Units already returned for this sale, across ALL past returns.
        const prev = await Return.find({ sale: sale._id }, null, { session });
        const alreadyReturned = {};
        for (const r of prev) {
          for (const it of r.items) {
            const k = String(it.product);
            alreadyReturned[k] = (alreadyReturned[k] || 0) + it.quantity;
          }
        }

        // Refund factor: how much of each line's sticker price the
        // customer actually paid, after discount and tax.
        // total = subtotal − discount + tax, so total/subtotal is the
        // paid fraction (1.0 when there is no discount or tax).
        const paidFactor =
          sale.subtotal > 0 ? sale.total / sale.subtotal : 1;

        let refundAmount = 0;
        const returnItems = [];
        for (const it of items) {
          if (!Number.isInteger(it.quantity) || it.quantity < 1) {
            throw new ReturnError(
              400,
              "Return quantities must be whole numbers of 1 or more"
            );
          }
          const line = sale.items.find(
            (l) => String(l.product) === String(it.product)
          );
          if (!line) {
            throw new ReturnError(400, "Item is not part of this sale");
          }
          const key = String(it.product);
          const remaining =
            line.quantity - (alreadyReturned[key] || 0);
          if (it.quantity > remaining) {
            throw new ReturnError(
              409,
              "Cannot return " +
                it.quantity +
                " of " +
                line.name +
                "; only " +
                remaining +
                " unit(s) remain"
            );
          }
          const refundPerUnit = line.price * paidFactor;
          refundAmount += refundPerUnit * it.quantity;
          returnItems.push({
            saleItem: line._id,
            product: it.product,
            name: line.name,
            quantity: it.quantity,
            refundPerUnit,
          });
        }

        // Destructure the array: await the Promise, then take [0].
        // (await create(...)[0] would index the Promise, not the array.)
        const [ret] = await Return.create(
          [
            {
              sale: saleId,
              items: returnItems,
              refundAmount,
              reason,
              handledBy: req.userId,
            },
          ],
          { session }
        );

        // Give each item's stock back and log the movement.
        for (const it of returnItems) {
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
                reason: "Return " + sale.invoiceNo,
                reference: sale.invoiceNo,
                doneBy: req.userId,
              },
            ],
            { session }
          );
        }

        // Cumulative check: if every line is now fully returned
        // (past returns + this one), mark the sale refunded.
        const fullyReturned = sale.items.every((l) => {
          const k = String(l.product);
          const thisQty = returnItems
            .filter((r) => String(r.product) === k)
            .reduce((s, r) => s + r.quantity, 0);
          return (alreadyReturned[k] || 0) + thisQty >= l.quantity;
        });
        if (fullyReturned) {
          sale.status = "refunded";
          await sale.save({ session });
        }

        return { ret, invoiceNo: sale.invoiceNo };
      },
      { readConcern: { level: "local" }, writeConcern: { w: "majority" } }
    );

    // Log entry (best-effort, outside the transaction).
    await Notification.create({
      type: "return",
      message:
        "Return processed for " +
        invoiceNo +
        " (LKR " +
        ret.refundAmount.toFixed(2) +
        ")",
    }).catch(() => {});

    res.status(201).json(ret);
  } catch (err) {
    if (err instanceof ReturnError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error("Return failed:", err && err.message);
    res.status(500).json({ error: "Return failed, please try again" });
  } finally {
    await session.endSession();
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
