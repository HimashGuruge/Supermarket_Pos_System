// controllers/dashboardController.js
// Computes the dashboard numbers from REAL sale data,
// not from a hardcoded file. Every number comes from
// the Sales collection, so it is always up to date.
//
// Timezone note: the store runs on Asia/Colombo (+5:30). Mongo
// stores dates in UTC, so any day/month bucketing must be done in
// the STORE's timezone, otherwise a sale at 01:00 local time (which
// is the previous day in UTC) would land in the wrong bucket.

const Sale = require("../models/Sale");
const Product = require("../models/Product");
const Customer = require("../models/Customer");
const Return = require("../models/Return");

// The store's timezone. Used for every date bucket below.
const TZ = "Asia/Colombo";

// Helper: the start of today, 00:00:00 (local).
function startOfToday() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// Load the returns that belong to a set of sale ids, grouped by sale.
async function returnsBySale(saleIds) {
  const out = {};
  if (!saleIds.length) return out;
  const rets = await Return.find({ sale: { $in: saleIds } });
  for (const r of rets) {
    (out[String(r.sale)] = out[String(r.sale)] || []).push(r);
  }
  return out;
}

// Compute profit for a set of sales, netting out their returns.
//
// Revenue = the money the store KEPT:
//   (subtotal - discount) is the net revenue (tax is a pass-through,
//   so it is not income), minus the money refunded for returns.
// COGS   = cost of goods sold, minus the cost of units that came back
//   through returns (that stock was restored, so its cost is saved).
// Profit = Revenue - COGS.
//
// A fully-returned sale nets to ~0 (money back + stock back), a
// cancelled sale is excluded entirely (never in the completed set).
function profitFor(sales, returnsBySale) {
  let revenue = 0;
  let cogs = 0;
  let refunded = 0;
  for (const s of sales) {
    const netRevenue = s.subtotal - s.discount;
    let saleCogs = 0;
    const lineCost = {};
    for (const it of s.items) {
      saleCogs += (it.costPerUnit || 0) * it.quantity;
      lineCost[String(it.product)] = it.costPerUnit || 0;
    }
    let refundTotal = 0;
    let returnedCogs = 0;
    const rets = returnsBySale[String(s._id)] || [];
    for (const r of rets) {
      refundTotal += r.refundAmount;
      for (const it of r.items) {
        returnedCogs += (lineCost[String(it.product)] || 0) * it.quantity;
      }
    }
    revenue += netRevenue - refundTotal;
    cogs += saleCogs - returnedCogs;
    refunded += refundTotal;
  }
  return {
    revenue,
    cogs,
    profit: revenue - cogs,
    refunded,
    margin: revenue > 0 ? (revenue - cogs) / revenue : 0,
  };
}

// GET /api/dashboard/stats
// The top cards and the recent activity.
async function stats(req, res) {
  const today = startOfToday();

  // Today's sales: sum of total for completed sales today.
  const todayAgg = await Sale.aggregate([
    { $match: { createdAt: { $gte: today }, status: "completed" } },
    { $group: { _id: null, revenue: { $sum: "$total" }, count: { $sum: 1 } } },
  ]);
  const todayRevenue = todayAgg[0]?.revenue || 0;
  const todayOrders = todayAgg[0]?.count || 0;

  // Total revenue: all completed sales ever.
  const allAgg = await Sale.aggregate([
    { $match: { status: "completed" } },
    { $group: { _id: null, revenue: { $sum: "$total" }, count: { $sum: 1 } } },
  ]);
  const totalRevenue = allAgg[0]?.revenue || 0;
  const totalOrders = allAgg[0]?.count || 0;

  // Counts.
  const [productCount, customerCount, lowStockCount] = await Promise.all([
    Product.countDocuments({ active: true }),
    Customer.countDocuments(),
    Product.countDocuments({ $expr: { $lte: ["$stock", "$minStock"] } }),
  ]);

  // Profit: today and overall, netting out returns (see profitFor).
  // Only completed + refunded sales are candidates; cancelled sales
  // are excluded (they net to zero).
  const [todaySales, allSales] = await Promise.all([
    Sale.find({ createdAt: { $gte: today }, status: { $in: ["completed", "refunded"] } }),
    Sale.find({ status: { $in: ["completed", "refunded"] } }),
  ]);
  const [todayRet, allRet] = await Promise.all([
    returnsBySale(todaySales.map((s) => s._id)),
    returnsBySale(allSales.map((s) => s._id)),
  ]);
  const todayProfit = profitFor(todaySales, todayRet);
  const totalProfit = profitFor(allSales, allRet);

  // Recent transactions: last 12 sales.
  const recent = await Sale.find()
    .sort({ createdAt: -1 })
    .limit(12)
    .populate("customer", "name")
    .populate("cashier", "name");

  res.json({
    todayRevenue,
    todayOrders,
    totalRevenue,
    totalOrders,
    productCount,
    customerCount,
    lowStockCount,
    todayProfit,
    totalProfit,
    recent,
  });
}

// GET /api/dashboard/daily-sales?days=7
// One number per day for the bar chart.
async function dailySales(req, res) {
  const days = Math.min(Number(req.query.days) || 7, 31);

  // Build a list of the last N days, each starting at local midnight.
  const buckets = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    buckets.push(d);
  }

  // Sum sales per day, bucketed in the STORE's timezone.
  const start = buckets[0];
  const rows = await Sale.aggregate([
    { $match: { createdAt: { $gte: start }, status: "completed" } },
    {
      $group: {
        _id: {
          // Bucket by the store's local calendar day.
          $dateToString: {
            format: "%Y-%m-%d",
            date: "$createdAt",
            timezone: TZ,
          },
        },
        total: { $sum: "$total" },
      },
    },
  ]);

  // Map each day to its total (0 if no sales that day).
  const map = {};
  for (const r of rows) map[r._id] = r.total;

  const out = buckets.map((d) => {
    const label = d.toLocaleDateString("en", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    // Build the key from the LOCAL date to match the aggregation bucket.
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return { label, value: map[y + "-" + m + "-" + day] || 0 };
  });

  res.json(out);
}

// GET /api/dashboard/monthly-sales
// One number per month for the last 12 months.
async function monthlySales(req, res) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  start.setHours(0, 0, 0, 0);

  const rows = await Sale.aggregate([
    { $match: { createdAt: { $gte: start }, status: "completed" } },
    {
      $group: {
        _id: {
          // Bucket by the store's local month.
          $dateToString: {
            format: "%Y-%m",
            date: "$createdAt",
            timezone: TZ,
          },
        },
        total: { $sum: "$total" },
      },
    },
  ]);

  const map = {};
  for (const r of rows) map[r._id] = r.total;

  const out = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    out.push({
      label: d.toLocaleDateString("en", { month: "short" }),
      value: map[y + "-" + m] || 0,
    });
  }
  res.json(out);
}

// GET /api/dashboard/profit?days=30
// Profit for a recent window: summary, a monthly trend, and the
// top products by profit. Defaults to the last 30 days.
async function profit(req, res) {
  const days = Math.min(Number(req.query.days) || 30, 180);
  const now = new Date();
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);

  // Candidate sales in the window (cancelled sales net to zero and are
  // excluded); returns are netted out per sale.
  const sales = await Sale.find({
    createdAt: { $gte: start },
    status: { $in: ["completed", "refunded"] },
  });
  const rets = await returnsBySale(sales.map((s) => s._id));
  const summary = profitFor(sales, rets);

  // Monthly trend over the window, bucketed by local month.
  const byMonthMap = {};
  for (const s of sales) {
    const d = new Date(s.createdAt);
    const key =
      d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
    const netRevenue = s.subtotal - s.discount;
    let saleCogs = 0;
    const lineCost = {};
    for (const it of s.items) {
      saleCogs += (it.costPerUnit || 0) * it.quantity;
      lineCost[String(it.product)] = it.costPerUnit || 0;
    }
    let refundTotal = 0;
    let returnedCogs = 0;
    for (const r of rets[String(s._id)] || []) {
      refundTotal += r.refundAmount;
      for (const it of r.items) {
        returnedCogs += (lineCost[String(it.product)] || 0) * it.quantity;
      }
    }
    const m = (byMonthMap[key] = byMonthMap[key] || { revenue: 0, cogs: 0 });
    m.revenue += netRevenue - refundTotal;
    m.cogs += saleCogs - returnedCogs;
  }
  const byMonth = [];
  const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
  for (let d = new Date(monthStart); d <= now; d.setMonth(d.getMonth() + 1)) {
    const key =
      d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
    const m = byMonthMap[key] || { revenue: 0, cogs: 0 };
    byMonth.push({
      key,
      label: d.toLocaleDateString("en", { month: "short", year: "2-digit" }),
      revenue: m.revenue,
      profit: m.revenue - m.cogs,
    });
  }

  // Top products by profit. Gross per unit = price - costPerUnit;
  // netted by subtracting units returned. (Store-level discount and
  // tax are not attributed per product, so this is gross profit.)
  const prodMap = {};
  for (const s of sales) {
    for (const it of s.items) {
      const k = String(it.product);
      const p = (prodMap[k] = prodMap[k] || {
        product: it.product,
        name: it.name,
        units: 0,
        revenue: 0,
        cogs: 0,
      });
      p.units += it.quantity;
      p.revenue += it.price * it.quantity;
      p.cogs += (it.costPerUnit || 0) * it.quantity;
    }
  }
  // Subtract returned units per product.
  for (const r of Object.values(rets).flat()) {
    for (const it of r.items) {
      const p = prodMap[String(it.product)];
      if (!p) continue;
      p.units -= it.quantity;
      p.revenue -= it.price * it.quantity;
      p.cogs -= (it.costPerUnit || 0) * it.quantity;
    }
  }
  const byProduct = Object.values(prodMap)
    .map((p) => ({
      name: p.name,
      units: p.units,
      revenue: p.revenue,
      profit: p.revenue - p.cogs,
    }))
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 10);

  res.json({ summary, byMonth, byProduct });
}

// GET /api/dashboard/top-products?limit=5
// Best-selling products, ranked by units sold.
async function topProducts(req, res) {
  const limit = Math.min(Number(req.query.limit) || 5, 20);
  const rows = await Sale.aggregate([
    { $match: { status: "completed" } },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.product",
        units: { $sum: "$items.quantity" },
      },
    },
    { $sort: { units: -1 } },
    { $limit: limit },
    { $lookup: { from: "products", localField: "_id", foreignField: "_id", as: "p" } },
    { $match: { "p.0": { $exists: true } } },
    { $addFields: { name: { $first: "$p.name" } } },
    { $project: { name: 1, units: 1 } },
  ]);
  res.json(rows);
}

module.exports = { stats, dailySales, monthlySales, profit, topProducts };
