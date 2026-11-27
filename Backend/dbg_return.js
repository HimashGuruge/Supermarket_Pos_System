// dbg_return.js — log the exact shape of Return.create([...], { session })
// and what withTransaction returns. Aborts at the end so nothing persists.
const mongoose = require("mongoose");
const Return = require("./models/Return");
const Sale = require("./models/Sale");

const URI = "mongodb://127.0.0.1:27017/posdb";

async function main() {
  console.log("mongoose version:", mongoose.version);
  await mongoose.connect(URI);
  const sale = await Sale.findOne({ status: "completed" });
  if (!sale) { console.log("no completed sale"); return; }
  const line = sale.items[0];

  const session = await mongoose.startSession();
  try {
    const out = await session.withTransaction(async () => {
      const created = await Return.create(
        [
          {
            sale: sale._id,
            items: [{ saleItem: line._id, product: line.product, name: line.name, quantity: 1, refundPerUnit: 1 }],
            refundAmount: 1,
            reason: "dbg",
            handledBy: sale.cashier,
          },
        ],
        { session }
      );
      console.log("create() isArray:", Array.isArray(created));
      console.log("create() length:", created && created.length);
      console.log("create() typeof:", typeof created);
      if (created && created[0]) {
        console.log("create()[0]._id:", created[0]._id);
      }
      // Abort so this document is not persisted.
      throw new Error("abort-for-db");
      return { ret: created && created[0] };
    }, { readConcern: { level: "local" }, writeConcern: { w: "majority" } });
    console.log("withTransaction result:", out);
  } catch (e) {
    console.log("TX ended with:", e.message);
  } finally {
    await session.endSession();
    await mongoose.disconnect();
  }
}

main();
