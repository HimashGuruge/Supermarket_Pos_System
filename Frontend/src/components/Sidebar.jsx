// src/components/Sidebar.jsx
// The side menu. It only shows the links that belong to the
// logged-in user's role (see src/lib/roles.js).

import { NavLink } from "react-router-dom";
import { X } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { menuFor } from "../lib/roles";

export default function Sidebar({ open, onClose }) {
  const { user } = useAuth();
  const menuItems = menuFor(user ? user.role : null);

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 w-64 transform bg-gray-900 text-white transition-transform duration-300 lg:static lg:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="flex h-16 items-center justify-between border-b border-gray-700 px-6">
        <h1 className="text-xl font-bold">Supermarket POS</h1>
        <button
          type="button"
          onClick={onClose}
          className="lg:hidden"
          aria-label="Close sidebar"
        >
          <X size={22} />
        </button>
      </div>

      <nav className="space-y-2 p-4">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-4 py-3 transition ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "text-gray-300 hover:bg-gray-800"
                }`
              }
            >
              <Icon size={20} />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
