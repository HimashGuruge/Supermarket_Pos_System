// seed/seed.js
// Fills an empty database with real starting data:
//   - 3 users (admin, cashier, stock manager)
//   - 8 categories
//   - 38 products with real barcodes, stock, and expiry dates
//   - 2 suppliers
//   - 3 customers
//   - 1 settings document
//
// It only inserts when a collection is empty, so running it
// again does not create duplicates. Run it by calling
// seed() from index.js after the DB connection opens.

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const User = require("../models/User");
const Category = require("../models/Category");
const Product = require("../models/Product");
const Customer = require("../models/Customer");
const Supplier = require("../models/Supplier");
const Settings = require("../models/Settings");

// ---------------------------------------------------------------------------
// USERS — the 3 people who can log in.
// Password for all three is "admin123" / "cashier123" / "stock123".
// We hash the password here the same way the model does.
// ---------------------------------------------------------------------------
const users = [
  {
    name: "Admin User",
    email: "admin@pos.com",
    password: "admin123",
    role: "admin",
  },
  {
    name: "Kavinda Perera",
    email: "cashier@pos.com",
    password: "cashier123",
    role: "cashier",
  },
  {
    name: "Sachini Silva",
    email: "stock@pos.com",
    password: "stock123",
    role: "stock",
  },
];

// ---------------------------------------------------------------------------
// CATEGORIES — how products are grouped on the shelf.
// ---------------------------------------------------------------------------
const categories = [
  "Beverages",
  "Dairy",
  "Bakery",
  "Snacks",
  "Fresh Produce",
  "Frozen",
  "Household",
  "Personal Care",
];

// ---------------------------------------------------------------------------
// PRODUCTS — 40 items with barcodes.
// barcode = a unique number the scanner reads.
// Some are low-stock (stock <= minStock) and some have
// expiry dates near, so the alerts have something to show.
// ---------------------------------------------------------------------------
// Helper: days from now, so expiry dates are always "in the future".
function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

const products = [
  // ---- Beverages ----
  { name: "Coca Cola 330ml", barcode: "8901001", category: "Beverages", purchasePrice: 90, salePrice: 120, stock: 120, minStock: 20, expiryDate: daysFromNow(180) },
  { name: "Nescafe Coffee 100g", barcode: "8901002", category: "Beverages", purchasePrice: 450, salePrice: 550, stock: 35, minStock: 10, expiryDate: daysFromNow(365) },
  { name: "Milo 400g", barcode: "8901003", category: "Beverages", purchasePrice: 520, salePrice: 650, stock: 8, minStock: 10, expiryDate: daysFromNow(300) },
  { name: "Minute Maid Juice 1L", barcode: "8901004", category: "Beverages", purchasePrice: 280, salePrice: 350, stock: 40, minStock: 15, expiryDate: daysFromNow(90) },
  { name: "Evian Water 500ml", barcode: "8901005", category: "Beverages", purchasePrice: 60, salePrice: 80, stock: 300, minStock: 50, expiryDate: daysFromNow(720) },

  // ---- Dairy ----
  { name: "Fresh Milk 1L", barcode: "8902001", category: "Dairy", purchasePrice: 280, salePrice: 320, stock: 25, minStock: 20, expiryDate: daysFromNow(7) },
  { name: "Cheddar Cheese 200g", barcode: "8902002", category: "Dairy", purchasePrice: 650, salePrice: 800, stock: 15, minStock: 5, expiryDate: daysFromNow(60) },
  { name: "Yogurt 4x100g", barcode: "8902003", category: "Dairy", purchasePrice: 300, salePrice: 380, stock: 3, minStock: 8, expiryDate: daysFromNow(14) },
  { name: "Butter 200g", barcode: "8902004", category: "Dairy", purchasePrice: 550, salePrice: 700, stock: 18, minStock: 6, expiryDate: daysFromNow(120) },
  { name: "Eggs (12 pack)", barcode: "8902005", category: "Dairy", purchasePrice: 350, salePrice: 420, stock: 45, minStock: 20, expiryDate: daysFromNow(14) },

  // ---- Bakery ----
  { name: "White Bread 400g", barcode: "8903001", category: "Bakery", purchasePrice: 180, salePrice: 220, stock: 60, minStock: 25, expiryDate: daysFromNow(3) },
  { name: "Butter Croissant", barcode: "8903002", category: "Bakery", purchasePrice: 120, salePrice: 180, stock: 24, minStock: 12, expiryDate: daysFromNow(2) },
  { name: "Chocolate Donut", barcode: "8903003", category: "Bakery", purchasePrice: 80, salePrice: 150, stock: 18, minStock: 10, expiryDate: daysFromNow(2) },
  { name: "Muffin Blueberry", barcode: "8903004", category: "Bakery", purchasePrice: 90, salePrice: 140, stock: 6, minStock: 8, expiryDate: daysFromNow(1) },

  // ---- Snacks ----
  { name: "Lay's Chips 60g", barcode: "8904001", category: "Snacks", purchasePrice: 180, salePrice: 250, stock: 80, minStock: 30, expiryDate: daysFromNow(180) },
  { name: "KitKat 4 Fingers", barcode: "8904002", category: "Snacks", purchasePrice: 150, salePrice: 200, stock: 90, minStock: 30, expiryDate: daysFromNow(240) },
  { name: "Doritos Nacho 75g", barcode: "8904003", category: "Snacks", purchasePrice: 200, salePrice: 270, stock: 2, minStock: 15, expiryDate: daysFromNow(150) },
  { name: "M&M's 40g", barcode: "8904004", category: "Snacks", purchasePrice: 160, salePrice: 220, stock: 45, minStock: 20, expiryDate: daysFromNow(200) },
  { name: "Snickers Bar", barcode: "8904005", category: "Snacks", purchasePrice: 130, salePrice: 180, stock: 65, minStock: 25, expiryDate: daysFromNow(190) },
  { name: "Pretzels 100g", barcode: "8904006", category: "Snacks", purchasePrice: 250, salePrice: 320, stock: 30, minStock: 12, expiryDate: daysFromNow(160) },

  // ---- Fresh Produce ----
  { name: "Bananas (per kg)", barcode: "8905001", category: "Fresh Produce", purchasePrice: 250, salePrice: 350, stock: 50, minStock: 20, expiryDate: daysFromNow(4) },
  { name: "Apples (per kg)", barcode: "8905002", category: "Fresh Produce", purchasePrice: 300, salePrice: 400, stock: 40, minStock: 15, expiryDate: daysFromNow(10) },
  { name: "Tomatoes (per kg)", barcode: "8905003", category: "Fresh Produce", purchasePrice: 200, salePrice: 300, stock: 5, minStock: 15, expiryDate: daysFromNow(5) },
  { name: "Onions (per kg)", barcode: "8905004", category: "Fresh Produce", purchasePrice: 150, salePrice: 220, stock: 35, minStock: 15, expiryDate: daysFromNow(30) },
  { name: "Potatoes (per kg)", barcode: "8905005", category: "Fresh Produce", purchasePrice: 120, salePrice: 180, stock: 55, minStock: 20, expiryDate: daysFromNow(60) },
  { name: "Cucumber (per kg)", barcode: "8905006", category: "Fresh Produce", purchasePrice: 180, salePrice: 280, stock: 22, minStock: 10, expiryDate: daysFromNow(7) },

  // ---- Frozen ----
  { name: "Frozen Peas 500g", barcode: "8906001", category: "Frozen", purchasePrice: 350, salePrice: 450, stock: 20, minStock: 8, expiryDate: daysFromNow(300) },
  { name: "Ice Cream 2L", barcode: "8906002", category: "Frozen", purchasePrice: 1200, salePrice: 1500, stock: 12, minStock: 6, expiryDate: daysFromNow(200) },
  { name: "Frozen Pizza 9 inch", barcode: "8906003", category: "Frozen", purchasePrice: 600, salePrice: 800, stock: 0, minStock: 10, expiryDate: daysFromNow(150) },

  // ---- Household ----
  { name: "Dishwash Liquid 500ml", barcode: "8907001", category: "Household", purchasePrice: 250, salePrice: 350, stock: 40, minStock: 15, expiryDate: daysFromNow(500) },
  { name: "Paper Towels 4 roll", barcode: "8907002", category: "Household", purchasePrice: 350, salePrice: 450, stock: 3, minStock: 10, expiryDate: null },
  { name: "Toilet Tissue 6 roll", barcode: "8907003", category: "Household", purchasePrice: 300, salePrice: 400, stock: 55, minStock: 20, expiryDate: null },
  { name: "Batteries AA 4 pack", barcode: "8907004", category: "Household", purchasePrice: 250, salePrice: 350, stock: 30, minStock: 10, expiryDate: null },
  { name: "Matchbox", barcode: "8907005", category: "Household", purchasePrice: 20, salePrice: 40, stock: 100, minStock: 30, expiryDate: null },

  // ---- Personal Care ----
  { name: "Dove Soap 100g", barcode: "8908001", category: "Personal Care", purchasePrice: 180, salePrice: 250, stock: 45, minStock: 15, expiryDate: daysFromNow(400) },
  { name: "Colgate Toothpaste 100g", barcode: "8908002", category: "Personal Care", purchasePrice: 250, salePrice: 330, stock: 35, minStock: 15, expiryDate: daysFromNow(600) },
  { name: "Shampoo 400ml", barcode: "8908003", category: "Personal Care", purchasePrice: 450, salePrice: 580, stock: 10, minStock: 8, expiryDate: daysFromNow(500) },
  { name: "Handwash 300ml", barcode: "8908004", category: "Personal Care", purchasePrice: 220, salePrice: 300, stock: 28, minStock: 12, expiryDate: daysFromNow(450) },
];

// ---------------------------------------------------------------------------
// SUPPLIERS — who the store buys from.
// ---------------------------------------------------------------------------
const suppliers = [
  {
    name: "Metro Wholesale",
    contactPerson: "Ravi Fernando",
    phone: "+94 11 234 5678",
    email: "orders@metro.lk",
    address: "12 Station Road, Colombo 03",
  },
  {
    name: "Fresh Farms Lanka",
    contactPerson: "Nimali Jayasinghe",
    phone: "+94 11 987 6543",
    email: "supply@freshfarms.lk",
    address: "45 Galle Road, Peradeniya",
  },
];

// ---------------------------------------------------------------------------
// CUSTOMERS — a few registered customers for the customer list.
// Walk-in sales still work with no customer at all.
// ---------------------------------------------------------------------------
const customers = [
  {
    name: "Olivia Martin",
    phone: "+94 71 123 4567",
    email: "olivia@example.com",
    address: "12 Lake Road, Colombo 07",
  },
  {
    name: "Jackson Lee",
    phone: "+94 72 234 5678",
    email: "jackson@example.com",
    address: "88 Galle Road, Colombo 03",
  },
  {
    name: "Isabella Nguyen",
    phone: "+94 77 345 6789",
    email: "isabella@example.com",
    address: "55 Marine Drive, Colombo 01",
  },
];

// ---------------------------------------------------------------------------
// SETTINGS — one document with the store's details.
// ---------------------------------------------------------------------------
const settings = {
  storeName: "Supermart Colombo",
  address: "No 123, Galle Road, Colombo 03",
  phone: "+94 11 123 4567",
  currency: "LKR",
  taxRate: 0,
  receiptFooter: "Thank you for shopping with Supermart!",
  lowStockThreshold: 5,
};

// ---------------------------------------------------------------------------
// seed() — insert each collection only if it is empty.
// The count check is what prevents duplicates on re-run.
// ---------------------------------------------------------------------------
async function seed() {
  // Users
  if ((await User.countDocuments()) === 0) {
    for (const u of users) {
      // Hash the password before saving, same as the model does.
      const salt = await bcrypt.genSalt(10);
      u.password = await bcrypt.hash(u.password, salt);
    }
    await User.insertMany(users);
    console.log("Seeded " + users.length + " users");
  }

  // Categories
  if ((await Category.countDocuments()) === 0) {
    const docs = categories.map((name) => ({ name }));
    await Category.insertMany(docs);
    console.log("Seeded " + categories.length + " categories");
  }

  // Products — need the category _id to fill in the category field.
  if ((await Product.countDocuments()) === 0) {
    const catMap = {};
    const cats = await Category.find();
    for (const c of cats) catMap[c.name] = c._id;

    const docs = products.map((p) => ({
      ...p,
      category: catMap[p.category], // replace the name with the real id
      sku: p.barcode, // start with sku = barcode, edit later if needed
    }));
    await Product.insertMany(docs);
    console.log("Seeded " + products.length + " products");
  }

  // Suppliers
  if ((await Supplier.countDocuments()) === 0) {
    await Supplier.insertMany(suppliers);
    console.log("Seeded " + suppliers.length + " suppliers");
  }

  // Customers
  if ((await Customer.countDocuments()) === 0) {
    await Customer.insertMany(customers);
    console.log("Seeded " + customers.length + " customers");
  }

  // Settings
  if ((await Settings.countDocuments()) === 0) {
    await Settings.create(settings);
    console.log("Seeded settings");
  }
}

module.exports = { seed };
