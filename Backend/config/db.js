// config/db.js
// Connects to MongoDB using Mongoose.
// Mongoose gives us models, validation, and transactions.
// We connect once on startup; every route uses the same connection.

const mongoose = require("mongoose");
require("dotenv").config(); // reads the .env file automatically

// The database address from .env, with a sensible fallback.
const URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/posdb";

// Connect to MongoDB.
async function connect() {
  await mongoose.connect(URI);
  console.log("Connected to MongoDB via Mongoose");
  return mongoose.connection;
}

// Expose the connection so other files can check status if needed.
module.exports = { connect };
