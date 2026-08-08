import { API_BASE } from "./config";

/**
 * Auth calls go through the REX API. The session token lives in an httpOnly
 * cookie set by Express — JavaScript never sees or stores it. `credentials`
 * keeps the cookie flowing on the same-origin /api proxy path.
 */
async function request(path, options = {}) {
  let response;

  try {
    response = await fetch(`${API_BASE}/auth${path}`, {
      credentials: "same-origin",
      ...options,
    });
  } catch {
    throw new Error("Cannot reach the REX API — is the backend running?");
  }

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    // Server-provided, sanitized message (e.g. "Invalid credentials").
    if (body && typeof body.error === "string" && body.error.trim()) {
      throw new Error(body.error);
    }

    // Map common failures to actionable messages — never echo secrets.
    if (response.status === 404) {
      throw new Error(
        "Auth endpoint not found on the REX API — the backend needs a restart to load the auth routes.",
      );
    }
    if (response.status === 401) {
      throw new Error("Invalid username or password.");
    }
    if (response.status >= 500) {
      throw new Error("The REX API hit an internal error — check the backend logs.");
    }
    throw new Error(`Request failed (HTTP ${response.status}).`);
  }

  return body || {};
}

/** GET /api/auth/me — resolves the current session (401 when logged out). */
export async function getMe() {
  return request("/me");
}

/** POST /api/auth/login — verifies credentials against the REX backend. */
export async function login(username, password) {
  return request("/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
}

/** POST /api/auth/logout — clears the session cookie. */
export async function logout() {
  return request("/logout", { method: "POST" });
}
