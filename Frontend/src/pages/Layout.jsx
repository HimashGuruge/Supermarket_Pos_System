import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Bell, LogOut, Menu } from "lucide-react";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../contexts/AuthContext";

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
};

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const title = titles[pathname] ?? "Dashboard";

  // First letter for the little circle avatar.
  const initial = user && user.name ? user.name[0].toUpperCase() : "U";

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
        />
      )}

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content */}
      <main className="min-w-0 flex-1">
        {/* Header */}
        <header className="flex h-16 items-center justify-between bg-white px-4 shadow-sm sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden"
              aria-label="Open sidebar"
            >
              <Menu size={24} />
            </button>
            <h2 className="text-lg font-semibold text-gray-800">
              {title}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <button type="button" className="text-gray-600">
              <Bell size={21} />
            </button>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white">
                {initial}
              </div>
              <div className="hidden sm:block">
                <span className="block text-sm font-medium text-gray-800">
                  {user ? user.name : "User"}
                </span>
                {user && (
                  <span className="block text-xs capitalize text-gray-400">
                    {user.role}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={logout}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-800"
              >
                <LogOut size={16} />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-4 sm:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
