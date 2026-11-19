// routes/sales.js
// Sale URLs. The create handler needs the Socket.IO server,
// so it is passed in at mount time (see index.js).
//
// Cashiers create and view sales. Only admin and stock
// can cancel (which touches stock).

const express = require("express");
const c = require("../controllers/saleController");
const { requireAuth } = require("../middleware/auth");
const { authorize } = require("../middleware/authorize");

const router = express.Router();

router.use(requireAuth);

// GET  /api/sales — list (any role).
router.get("/", c.list);

// GET  /api/sales/:id — one sale / receipt (any role).
router.get("/:id", c.getOne);

// POST /api/sales — cashier or admin completes a sale.
// io is attached to req.app in index.js, so the controller
// can read it with req.app.get("io").
router.post(
  "/",
  authorize("cashier", "admin"),
  async (req, res, next) => {
    try {
      await c.create(req, res, req.app.get("io"));
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/sales/:id/cancel — admin or stock.
router.post(
  "/:id/cancel",
  authorize("admin", "stock"),
  async (req, res, next) => {
    try {
      await c.cancel(req, res);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
