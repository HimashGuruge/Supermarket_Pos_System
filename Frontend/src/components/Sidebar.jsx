// src/components/Sidebar.jsx
// The side menu. A dark nav rail that only shows the links that
// belong to the logged-in user's role (see src/lib/roles.js).

import { NavLink } from "react-router-dom";
import { LogOut, X } from "lucide-react";
import { menuFor } from "../lib/roles";
import { useAuth } from "../contexts/AuthContext";

// Which small section label each link sits under.
const sectionOrder = ["Overview", "Manage", "System"];
const sectionOf = {
  Dashboard: "Overview",
  POS: "Overview",
  Products: "Manage",
  Customers: "Manage",
  Sales: "Manage",
  Purchases: "Manage",
  Returns: "Manage",
  Settings: "System",
};

// Role badge tones tuned for the dark sidebar.
const roleBadge = {
  admin: "bg-white/10 text-slate-100",
  cashier: "bg-indigo-400/20 text-indigo-200",
  stock: "bg-emerald-400/20 text-emerald-200",
};

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth();
  const items = menuFor(user?.role);
  const initial = user && user.name ? user.name[0].toUpperCase() : "U";

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 w-64 transform overflow-hidden bg-slate-950 transition-transform duration-300 lg:static lg:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      {/* Soft accent glows behind everything */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_300px_at_20%_-5%,rgb(99_102_241/0.28),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(500px_320px_at_105%_105%,rgb(139_92_246/0.18),transparent_60%)]" />

      <div className="relative flex h-full flex-col">
        {/* Brand */}
        <div className="flex h-16 items-center gap-3 px-4 pt-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 ring-1 ring-white/20 shadow-card-lg">
            <span className="text-sm font-bold text-white">S</span>
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-semibold leading-tight text-white">
              Supermarket
            </h1>
            <p className="text-[11px] font-medium leading-none text-slate-400">
              POS System
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto -mr-2 rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="mt-2 flex-1 space-y-5 overflow-y-auto px-3 pb-4">
          {sectionOrder.map((section) => {
            const group = items.filter((i) => sectionOf[i.name] === section);
            if (!group.length) return null;
            return (
              <div key={section}>
                <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {section}
                </p>
                <div className="space-y-1">
                  {group.map((item) => {
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.end}
                        onClick={onClose}
                        className={({ isActive }) =>
                          `group relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                            isActive
                              ? "bg-white/10 text-white"
                              : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
                          }`
                        }
                      >
                        {({ isActive }) => (
                          <>
                            {isActive && (
                              <span
                                aria-hidden="true"
                                className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-gradient-to-b from-indigo-400 to-violet-500"
                              />
                            )}
                            <span
                              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition ${
                                isActive
                                  ? "bg-white/10 text-white"
                                  : "bg-white/5 text-slate-400 group-hover:text-slate-200"
                              }`}
                            >
                              <Icon size={16} strokeWidth={2} />
                            </span>
                            <span className="truncate">{item.name}</span>
                          </>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* User card */}
        <div className="px-3 pb-3">
          <div className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white ring-1 ring-white/20">
                {initial}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">
                  {user?.name ?? "User"}
                </p>
                <span
                  className={`mt-0.5 inline-block rounded-md px-1.5 py-0.5 text-[10px] font-semibold capitalize ${
                    roleBadge[user?.role] ?? "bg-white/10 text-slate-300"
                  }`}
                >
                  {user?.role ?? "user"}
                </span>
              </div>
              <button
                type="button"
                onClick={logout}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
                aria-label="Log out"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
