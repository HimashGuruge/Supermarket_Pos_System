import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Bell, Menu, Search } from "lucide-react";
import Sidebar from "../components/Sidebar";

const titles = {
  "/": "Dashboard",
  "/pos": "POS",
  "/about": "About",
  "/profile": "Profile",
  "/settings": "Settings",
  "/products": "Products",
  "/customers": "Customers",
  "/purchases": "Purchases",
  "/returns": "Returns",
  "/sales": "Sales History",
};

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { pathname } = useLocation();
  const title = titles[pathname] ?? "Dashboard";

  return (
    <div className="flex min-h-screen bg-app">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
        />
      )}

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content */}
      <main className="min-w-0 flex-1">
        {/* Header */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200/70 bg-card/80 px-3 sm:px-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Open sidebar"
            >
              <Menu size={20} />
            </button>
            <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
          </div>

          <div className="ml-2 hidden max-w-xs items-center lg:block">
            <div className="relative w-full">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={16}
              />
              <input
                aria-label="Search"
                placeholder="Search products, customers…"
                className="w-full rounded-lg border border-slate-200 bg-surface py-2 pl-8 pr-3 text-sm text-slate-700 transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>

          <div className="ml-auto">
            <button
              type="button"
              className="relative rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Notifications"
            >
              <Bell size={20} />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-card" />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-3 sm:p-4">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
