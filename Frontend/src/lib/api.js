// src/lib/api.js
// One shared axios instance for the whole app.
//
// Why one instance:
//   - Every request automatically carries the login token.
//   - Every error is handled in one place (see the interceptor below).
//   - Pages just write  api.get("/products")  instead of typing the
//     full URL and headers each time.

import axios from "axios";

// The backend address. We read it from a Vite env var if present,
// otherwise fall back to the local dev server on port 3000.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000/api",
});

// Runs BEFORE every request goes out.
// If the user is logged in, attach their token to the header
// so the backend knows who is asking.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("pos_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Runs AFTER every response comes back.
// If the token has expired or is wrong, the backend answers 401.
// We then log the user out by firing a small event that the
// AuthContext listens for. This keeps the two files decoupled.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response && err.response.status === 401) {
      localStorage.removeItem("pos_token");
      window.dispatchEvent(new CustomEvent("pos:unauthorized"));
    }
    return Promise.reject(err);
  }
);

// Helper that reads a friendly error message from an axios error.
// Every page can call  errorMessage(err)  and get plain English.
export function errorMessage(err) {
  // The backend always sends { error: "..." } in the body.
  if (err.response && err.response.data && err.response.data.error) {
    return err.response.data.error;
  }
  // Network problem (server not running, etc.)
  if (err.code === "ERR_NETWORK") {
    return "Could not reach the server. Is the backend running?";
  }
  return err.message || "Something went wrong";
}

export default api;
