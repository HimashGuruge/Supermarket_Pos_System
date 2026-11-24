// index.js
// The POS server. Runs on port 3000.
//
// Layout of this file:
//   1. Pull in the tools.
//   2. Build the Express app (JSON + CORS).
//   3. Add Socket.IO for live updates (new sales, stock alerts).
//   4. Mount each route file under its /api/... path.
//   5. Safety nets: 404 page and a final error handler.
//   6. Connect to MongoDB, seed if empty, then start listening.

// 1. Tools
const express = require("express");
const cors = require("cors");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
require("dotenv").config(); // reads .env (MONGO_URI, JWT_SECRET, PORT)

const { connect } = require("./config/db");
const { seed } = require("./seed/seed");

// 2. The app. express.json() reads request bodies as JS objects,
//    so controllers can use req.body directly.
const app = express();

// Only the local frontend origins may call the API from a browser.
// (Servers without an Origin header — e.g. curl, the seed script —
// are still allowed, so API testing keeps working.)
const FRONTEND_ORIGINS = ["http://localhost:5173", "http://localhost:5174"];
app.use(
  cors({
    origin: (origin, callback) => {
      callback(null, !origin || FRONTEND_ORIGINS.includes(origin));
    },
  })
);
app.use(express.json());

// 3. Socket.IO.
// A plain Express server cannot hold a socket connection, so we
// wrap it: create an http server around the app, and let Socket.IO
// listen on that. When something happens (a sale is made), the
// controller calls io.emit(...) and every connected browser
// receives the event.
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    // The two ports the frontend might be running on.
    origin: ["http://localhost:5173", "http://localhost:5174"],
  },
});

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);
});
io.on("disconnection", (socket) => {
  console.log("Socket left:", socket.id);
});

// Store io on the app so controllers can reach it with
// req.app.get("io") without importing it everywhere.
app.set("io", io);

// 4. Mount the route files. Each file is a small router that
//    owns one part of the app, so index.js stays short.
//    URL pattern:  /api/sales  ->  routes/sales.js
app.use("/api/auth", require("./routes/auth"));
app.use("/api/products", require("./routes/products"));
app.use("/api/categories", require("./routes/categories"));
app.use("/api/customers", require("./routes/customers"));
app.use("/api/suppliers", require("./routes/suppliers"));
app.use("/api/sales", require("./routes/sales"));
app.use("/api/purchases", require("./routes/purchases"));
app.use("/api/returns", require("./routes/returns"));
app.use("/api/users", require("./routes/users"));
app.use("/api/stock-movements", require("./routes/stock-movements"));
app.use("/api/dashboard", require("./routes/dashboard"));
app.use("/api/settings", require("./routes/settings"));
app.use("/api/notifications", require("./routes/notifications"));

// Serve uploaded files (the store logo) under /uploads.
// The logo is saved into Backend/uploads and the settings document
// stores its path, e.g. "/uploads/logo-1712345678.png".
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// 5. Safety nets.
// 404: a URL that matched no route gets a friendly answer.
app.use((req, res) => {
  res.status(404).json({ error: "Route not found: " + req.url });
});
// Error handler: any thrown/next(err) lands here with a message.
// (Must have 4 parameters for Express to recognize it.)
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({
    error: err.message || "Server error",
  });
});

// 6. Start: connect to MongoDB, fill an empty database with
//    seed data, then open the port.
const PORT = process.env.PORT || 3000;

// Refuse to boot with the built-in fallback JWT secret: anyone who
// can read the code could then forge login tokens.
if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET is not set in .env — refusing to start.");
  console.error("Add a long random value, e.g.:");
  console.error("  JWT_SECRET=0123456789abcdef0123456789abcdef0123456789abcdef");
  process.exit(1);
}

connect()
  .then(async () => {
    await seed(); // safe to run twice; only fills empty collections
    server.listen(PORT, () => {
      console.log("POS backend running on http://localhost:" + PORT);
    });
  })
  .catch((err) => {
    console.error("Could not connect to MongoDB:", err.message);
    console.error("Is MongoDB running? (port 27017)");
    process.exit(1); // stop with a clear sign
  });
