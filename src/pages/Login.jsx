import "./Login.css";

import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  User,
} from "lucide-react";

import { useAuth } from "../hooks/useAuth";
import { config } from "../data/config";

export default function Login() {
  const { user, checking, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const params = new URLSearchParams(location.search);
  const returnTo = params.get("returnTo") || "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Already signed in — skip the login screen.
  if (!checking && user) {
    return <Navigate to={returnTo} replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!username.trim() || !password) {
      setError("Enter your username and password.");
      return;
    }

    setBusy(true);

    try {
      await signIn(username, password);
      navigate(returnTo, { replace: true });
    } catch (err) {
      setError(
        err.message === "Invalid credentials"
          ? "Invalid username or password."
          : err.message || "Unable to sign in. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card fade-up">
        <div className="login-brand">
          <div className="login-logo">⚓</div>
          <h1>{config.appName}</h1>
          <p>One Dream. One Will. One Power.</p>
          <span className="login-sub">Sign in to your command center</span>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="login-field">
            <span>Username</span>
            <div className="login-input">
              <User size={17} />
              <input
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="admin"
                autoComplete="username"
                autoFocus
                disabled={busy}
              />
            </div>
          </label>

          <label className="login-field">
            <span>Password</span>
            <div className="login-input">
              <Lock size={17} />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={busy}
              />
              <button
                type="button"
                className="login-eye"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>

          {error && (
            <div className="login-error" role="alert">
              <AlertTriangle size={15} />
              {error}
            </div>
          )}

          <button type="submit" className="login-btn" disabled={busy}>
            {busy ? (
              <>
                <Loader2 size={17} className="spin" />
                Signing in…
              </>
            ) : (
              "Sign in"
            )}
          </button>
        </form>

        <p className="login-foot">
          Credentials are verified by the REX API — nothing is stored in the
          browser.
        </p>
      </div>
    </div>
  );
}
