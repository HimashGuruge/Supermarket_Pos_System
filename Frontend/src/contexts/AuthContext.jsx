// src/contexts/AuthContext.jsx
// The single place that knows "who is logged in".
//
// What it does:
//   1. On first load, checks if a token was saved before.
//      If yes, it asks the backend "who is this token?" (/auth/me).
//      If that works, the user is logged in. If not, we are logged out.
//   2. login(email, password) calls the backend, saves the token
//      and the user, and remembers them in localStorage.
//   3. logout() clears the token and the user.
//   4. If any request gets a 401 (token expired), api.js fires a
//      "pos:unauthorized" event and we quietly log out here.
//
// Any component can call  const { user, login, logout, loading } = useAuth()

import { createContext, useContext, useEffect, useState } from "react";
import api from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // The logged-in user, or null if nobody is logged in.
  const [user, setUser] = useState(null);
  // True while we are checking a saved token on first load.
  const [checking, setChecking] = useState(true);

  // On first load: if a token exists, verify it with the backend.
  useEffect(() => {
    const token = localStorage.getItem("pos_token");
    if (!token) {
      setChecking(false); // no token, nothing to check
      return;
    }
    api
      .get("/auth/me")
      .then((res) => {
        setUser(res.data.user);
        setChecking(false);
      })
      .catch(() => {
        // Token is bad or expired -> treat as logged out.
        localStorage.removeItem("pos_token");
        setChecking(false);
      });
  }, []);

  // If api.js saw a 401 anywhere, log out quietly.
  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener("pos:unauthorized", onUnauthorized);
    return () => window.removeEventListener("pos:unauthorized", onUnauthorized);
  }, []);

  // Call this to sign in. Returns the user on success.
  // Throws a friendly error on failure (wrong email/password).
  async function login(email, password) {
    const res = await api.post("/auth/login", { email, password });
    localStorage.setItem("pos_token", res.data.token);
    setUser(res.data.user);
    return res.data.user;
  }

  // Call this to sign out.
  function logout() {
    localStorage.removeItem("pos_token");
    setUser(null);
  }

  // Re-fetch the current user from the backend. Used after the
  // profile picture changes so the avatar updates everywhere.
  async function refreshUser() {
    try {
      const res = await api.get("/auth/me");
      setUser(res.data.user);
      return res.data.user;
    } catch {
      return null;
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user ? user.role : null,
        checking,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Hook any component uses to get the auth info.
export function useAuth() {
  return useContext(AuthContext);
}
