const jwt = require("jsonwebtoken");

const TOKEN_COOKIE = "rexos_token";

/**
 * Session authentication for sensitive REX OS endpoints.
 *
 * The browser never holds the token in JavaScript: it lives in the httpOnly
 * `rexos_token` cookie set by POST /api/auth/login. This middleware verifies
 * the JWT server-side on every protected request — same validation used by
 * GET /api/auth/me.
 *
 * Applied to: /api/terminal/* (command execution), /api/storage,
 * /api/system/metrics and /api/docker/{stats,inspect}/:id.
 */

/** True when the request carries a valid REX OS session cookie. */
function isAuthenticated(req) {
  const token = req.cookies && req.cookies[TOKEN_COOKIE];
  if (!token) return false;
  try {
    jwt.verify(token, process.env.JWT_SECRET);
    return true;
  } catch {
    return false;
  }
}

/** Express middleware — rejects requests without a valid session with 401. */
function requireAuth(req, res, next) {
  if (!process.env.JWT_SECRET) {
    return res
      .status(500)
      .json({ status: "error", message: "Auth is not configured" });
  }
  if (!isAuthenticated(req)) {
    return res
      .status(401)
      .json({ status: "error", message: "Authentication required" });
  }
  next();
}

module.exports = { requireAuth, isAuthenticated };
