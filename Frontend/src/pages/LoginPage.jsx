// src/pages/LoginPage.jsx
// The screen shown before anyone signs in.
//
// How it works:
//   - A form with email and password.
//   - On submit it calls login() from the AuthContext.
//   - If it works, the user is saved and the router moves to the app.
//   - If it fails (wrong email or password), we show a toast and stay here.

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { Lock } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { errorMessage } from "../lib/api";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email || !password) {
      toast.warning("Please enter both email and password");
      return;
    }
    setBusy(true);
    try {
      const user = await login(email, password);
      toast.success("Welcome back, " + user.name);
      // Let the auth context finish updating, then move into the app.
      setTimeout(() => navigate("/", { replace: true }), 150);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-app p-4">
      <div className="w-full max-w-sm rounded-3xl border border-white/60 bg-card/80 p-8 shadow-card-lg backdrop-blur">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-card">
            <Lock size={22} className="text-white" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-slate-800">
            Supermarket POS
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Sign in to continue
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@pos.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <Button type="submit" loading={busy} className="w-full">
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
