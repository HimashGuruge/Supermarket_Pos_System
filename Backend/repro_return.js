// repro_return.js — isolate which return operation serializes a session.
const mongoose = require("mongoose");
const Sale = require("./models/Sale");
const Return = require("./models/Return");
const Product = require("./models/Product");
const StockMovement = require("./models/StockMovement");

const URI = "mongodb://127.0.0.1:27017/posdb";

async function main() {
  await mongoose.connect(URI);
  const sale = await Sale.findOne({ status: "completed" });
  if (!sale) { console.log("no completed sale"); return; }
  const line = sale.items[0];
  console.log("sale", sale._id, "line", line.product, line.name, line.quantity);

  const session = await mongoose.startSession();
  try {
    const r = await session.withTransaction(async () => {
      console.log("step1 Sale.findOne");
      const s = await Sale.findOne({ _id: sale._id }, { session });
      console.log("step1 ok", s._id);

      console.log("step2 Return.find");
      const prev = await Return.find({ sale: s._id }, { session });
      console.log("step2 ok count", prev.length);

      console.log("step3 Return.create");
      const ret = await Return.create([
        {
          sale: sale._id,
          items: [{ saleItem: line._id, product: line.product, name: line.name, quantity: 1, refundPerUnit: 1 }],
          refundAmount: 1,
          reason: "repro",
          handledBy: sale.cashier,
        },
      ], { session });
      console.log("step3 ok", ret[0]._id);

      console.log("step4 Product.updateOne");
      await Product.updateOne({ _id: line.product }, { $inc: { stock: 1 } }, { session });
      console.log("step4 ok");

      console.log("step5 StockMovement.create");
      await StockMovement.create([
        { product: line.product, type: "in", quantity: 1, reason: "repro", reference: "x", doneBy: sale.cashier },
      ], { session });
      console.log("step5 ok");

      return "ALL";
    }, { readConcern: { level: "local" }, writeConcern: { w: "majority" } });
    console.log("TX RESULT", r);
  } catch (e) {
    console.log("TX ERROR", e.message);
  } finally {
    await session.endSession();
    await mongoose.disconnect();
  }
}

main();
