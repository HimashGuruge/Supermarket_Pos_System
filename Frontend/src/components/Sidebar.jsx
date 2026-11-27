// src/components/Sidebar.jsx
// The side menu. A light nav rail that only shows the links that
// belong to the logged-in user's role (see src/lib/roles.js).

import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { LogOut, X } from "lucide-react";
import { menuFor } from "../lib/roles";
import { useAuth } from "../contexts/AuthContext";
import api, { apiOrigin } from "../lib/api";

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
  Profile: "System",
};

// Role badge tones tuned for the light sidebar.
const roleBadge = {
  admin: "bg-indigo-50 text-indigo-600 ring-indigo-100",
  cashier: "bg-violet-50 text-violet-600 ring-violet-100",
  stock: "bg-emerald-50 text-emerald-600 ring-emerald-100",
};

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth();
  const items = menuFor(user?.role);
  const initial = user && user.name ? user.name[0].toUpperCase() : "U";

  // The uploaded store logo (from the Settings page). Shown in the
  // brand tile; falls back to the "S" letter when none is set.
  const [logo, setLogo] = useState("");
  useEffect(() => {
    let active = true;
    api
      .get("/settings")
      .then((res) => {
        if (active && res.data && res.data.logo) setLogo(res.data.logo);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 w-64 border-r border-slate-200/70 bg-card/95 backdrop-blur transition-transform duration-300 lg:static lg:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="relative flex h-full flex-col">
        {/* Brand */}
        <div className="flex h-16 items-center gap-3 px-4">
          <div
            className={`flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl shadow-card ring-1 ring-white/40 ${
              logo ? "bg-white" : "bg-gradient-to-br from-indigo-500 to-violet-600"
            }`}
          >
            {logo ? (
              <img
                src={apiOrigin + logo}
                alt="Store logo"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-sm font-bold text-white">S</span>
            )}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-semibold leading-tight text-slate-800">
              Supermarket
            </h1>
            <p className="text-[11px] font-medium leading-none text-slate-400">
              POS System
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto -mr-2 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 lg:hidden"
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
                <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
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
                          `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                            isActive
                              ? "bg-indigo-50 text-indigo-700"
                              : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                          }`
                        }
                      >
                        {({ isActive }) => (
                          <>
                            {isActive && (
                              <span
                                aria-hidden="true"
                                className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-indigo-500"
                              />
                            )}
                            <span
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition ${
                                isActive
                                  ? "bg-white text-indigo-600 shadow-sm ring-1 ring-indigo-100"
                                  : "text-slate-400 group-hover:text-slate-600"
                              }`}
                            >
                              <Icon size={17} strokeWidth={2} />
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
          <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white ring-1 ring-white/40">
                {user?.avatar ? (
                  <img
                    src={apiOrigin + user.avatar}
                    alt="Profile"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initial
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800">
                  {user?.name ?? "User"}
                </p>
                <span
                  className={`mt-0.5 inline-block rounded-md px-1.5 py-0.5 text-[10px] font-semibold capitalize ring-1 ${
                    roleBadge[user?.role] ?? "bg-slate-100 text-slate-500 ring-slate-200"
                  }`}
                >
                  {user?.role ?? "user"}
                </span>
              </div>
              <button
                type="button"
                onClick={logout}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white hover:text-slate-600"
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
