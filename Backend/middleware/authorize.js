// middleware/authorize.js
// Role-based access control.
//
// After auth.js confirms "who" is logged in, this file checks
// "are they allowed" to do this specific action.
//
// Usage on a route:
//   app.post("/api/products", authorize("admin", "stock"), handler)
//   means only admin or stock users can create a product.
//
// The roles we support:
//   admin   — full access
//   cashier — billing and customer sales
//   stock   — products, stock, suppliers, purchases

// authorize(...roles) returns a middleware that checks the role.
function authorize(...roles) {
  return (req, res, next) => {
    // req.userRole was set by auth.js. If it is missing, something is wrong.
    if (!req.userRole) {
      res.status(401).json({ error: "Not logged in" });
      return;
    }

    // Check that the user's role is in the allowed list.
    if (!roles.includes(req.userRole)) {
      res.status(403).json({
        error: "You do not have permission to do this",
      });
      return;
    }

    next(); // allowed — continue to the route handler.
  };
}

module.exports = { authorize };
