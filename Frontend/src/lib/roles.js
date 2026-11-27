// src/lib/roles.js
// One place that says "what each role can see" in the sidebar.
//
// The backend already enforces permissions (a cashier cannot edit
// a product, etc.). This file only controls the MENU: which links
// show up in the sidebar.
//
// Roles (from the backend User model):
//   admin   — full access
//   cashier — billing (POS) and customers
//   stock   — products, stock, purchases and returns
//
// Only pages that already exist are listed here. As more management
// screens are built, add their entries below.

import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  PackagePlus,
  RotateCcw,
  Settings,
  Receipt,
  CircleUser,
} from "lucide-react";

// Build the sidebar menu for a given role.
// Each entry: { name, to, icon, end? }
export function menuFor(role) {
  const items = [];

  const dashboard = {
    name: "Dashboard",
    to: "/",
    icon: LayoutDashboard,
    end: true,
  };
  const pos = { name: "POS", to: "/pos", icon: ShoppingCart };
  const products = { name: "Products", to: "/products", icon: Package };
  const customers = { name: "Customers", to: "/customers", icon: Users };
  const purchases = { name: "Purchases", to: "/purchases", icon: PackagePlus };
  const returns = { name: "Returns", to: "/returns", icon: RotateCcw };
  const sales = { name: "Sales", to: "/sales", icon: Receipt };
  const settings = { name: "Settings", to: "/settings", icon: Settings };
  const profile = { name: "Profile", to: "/profile", icon: CircleUser };

  if (role === "admin") {
    items.push(
      dashboard,
      pos,
      products,
      customers,
      sales,
      purchases,
      returns,
      settings,
      profile
    );
  } else if (role === "cashier") {
    // Cashiers bill and can look at / add customers, plus their sales.
    items.push(pos, dashboard, customers, sales, profile);
  } else if (role === "stock") {
    // Stock manager handles products, customers, and stock in/out.
    // They also review sales, since cancelling gives stock back.
    items.push(products, dashboard, customers, sales, purchases, returns, profile);
  } else {
    // Unknown role: show only the safe dashboard.
    items.push(dashboard, profile);
  }

  return items;
}
