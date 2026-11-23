// src/components/Sidebar.jsx
// The side menu. It only shows the links that belong to the
// logged-in user's role (see src/lib/roles.js).

import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  Users,
  Truck,
  ArrowLeftFromLine,
  History,
  X,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

const items = [
  { to: "/", name: "Dashboard", icon: LayoutDashboard },
  { to: "/products", name: "Products", icon: Package },
  { to: "/customers", name: "Customers", icon: Users },
  { to: "/purchases", name: "Purchases", icon: Truck },
  { to: "/returns", name: "Returns", icon: ArrowLeftFromLine },
  { to: "/sales", name: "Sales History", icon: History },
];

export default function Sidebar({ open, onClose }) {
  const { user } = useAuth();

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 w-64 transform bg-white transition-transform duration-300 lg:static lg:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="flex h-14 items-center gap-2 border-b border-slate-100 px-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-card">
          <span className="text-sm font-bold text-white">S</span>
        </div>
        <div>
          <h1 className="text-lg font-bold leading-tight text-slate-800">
            Supermarket
          </h1>
          <p className="text-[11px] font-medium leading-none text-slate-400">
            POS System
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto -mr-2 lg:hidden rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          aria-label="Close sidebar"
        >
          <X size={18} />
        </button>
      </div>

      <nav className="mt-3 space-y-1 p-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? "bg-slate-900 text-white shadow-card"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                }`
              }
            >
              <Icon size={17} />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="absolute inset-x-4 bottom-3 rounded-2xl border border-slate-200 bg-surface p-3 lg:inset-auto">
        <div className="text-xs font-medium text-slate-400">Need a hand?</div>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          Scan items with your camera, add to cart, and check out in seconds.
        </p>
      </div>
    </aside>
  );
}
