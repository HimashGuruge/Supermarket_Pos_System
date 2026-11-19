// controllers/dashboardController.js
// Computes the dashboard numbers from REAL sale data,
// not from a hardcoded file. Every number comes from
// the Sales collection, so it is always up to date.

const Sale = require("../models/Sale");
const Product = require("../models/Product");
const Customer = require("../models/Customer");
const Notification = require("../models/Notification");

// Helper: the start of today, 00:00:00.
function startOfToday() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
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
    { $group: { _id: null, revenue: { $sum: "$total" } } },
  ]);
  const totalRevenue = allAgg[0]?.revenue || 0;

  // Counts.
  const [productCount, customerCount, lowStockCount] = await Promise.all([
    Product.countDocuments({ active: true }),
    Customer.countDocuments(),
    Product.countDocuments({ $expr: { $lte: ["$stock", "$minStock"] } }),
  ]);

  // Recent transactions: last 8 sales.
  const recent = await Sale.find()
    .sort({ createdAt: -1 })
    .limit(8)
    .populate("customer", "name")
    .populate("cashier", "name");

  res.json({
    todayRevenue,
    todayOrders,
    totalRevenue,
    productCount,
    customerCount,
    lowStockCount,
    recent,
  });
}

// GET /api/dashboard/daily-sales?days=7
// One number per day for the bar chart.
async function dailySales(req, res) {
  const days = Math.min(Number(req.query.days) || 7, 31);

  // Build a list of the last N days, each starting at midnight.
  const buckets = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    buckets.push(d);
  }

  // Sum sales per day.
  const start = buckets[0];
  const rows = await Sale.aggregate([
    { $match: { createdAt: { $gte: start }, status: "completed" } },
    {
      $group: {
        _id: {
          // bucket by UTC day so the chart groups by calendar day.
          $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
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
    // Format the key from the UTC date to match the aggregation bucket.
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
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
          $dateToString: { format: "%Y-%m", date: "$createdAt" },
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
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    out.push({
      label: d.toLocaleDateString("en", { month: "short" }),
      value: map[y + "-" + m] || 0,
    });
  }
  res.json(out);
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

module.exports = { stats, dailySales, monthlySales, topProducts };
