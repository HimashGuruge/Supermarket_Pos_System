// src/App.jsx
// The top of the app. Wires together:
//   - AuthProvider: knows who is logged in.
//   - Router: which screen to show.
//   - A login screen, and the main app behind a "must be logged in" gate.
//   - Toast notifications (the little pop-up messages).

import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "react-toastify/dist/ReactToastify.css";
import { ToastContainer } from "react-toastify";

import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Layout from "./pages/Layout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import AboutPage from "./pages/AboutPage";
import ProfilePage from "./pages/ProfilePage";
import SettingsPage from "./pages/SettingsPage";
import ProductsPage from "./pages/ProductsPage";
import PosPage from "./pages/PosPage";
import CustomersPage from "./pages/CustomersPage";
import PurchasesPage from "./pages/PurchasesPage";
import ReturnsPage from "./pages/ReturnsPage";
import SalesHistoryPage from "./pages/SalesHistoryPage";

// Shows a loading note while we check the saved token,
// bounces to /login if nobody is signed in,
// or shows the app if the user is valid.
function RequireAuth({ children }) {
  const { user, checking } = useAuth();

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 text-slate-500">
        Loading…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public: the login screen. */}
          <Route path="/login" element={<LoginPage />} />

          {/* Everything else needs a logged-in user.
              The RequireAuth gate wraps the Layout (sidebar + page). */}
          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route path="/" element={<DashboardPage />} />
            <Route path="/pos" element={<PosPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/purchases" element={<PurchasesPage />} />
            <Route path="/returns" element={<ReturnsPage />} />
            <Route path="/sales" element={<SalesHistoryPage />} />
          </Route>

          {/* Unknown page: go home. */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>

      {/* Where toasts appear, bottom right. */}
      <ToastContainer position="bottom-right" autoClose={2500} theme="colored" />
    </AuthProvider>
  );
}

export default App;
