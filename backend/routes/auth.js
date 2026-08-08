const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const router = express.Router();

const TOKEN_COOKIE = "rexos_token";
const SESSION_DAYS = 7;

/** Cookie is httpOnly + sameSite so the token never reaches JavaScript. */
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.COOKIE_SECURE === "true", // enable behind HTTPS
  maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
  path: "/",
};

function isConfigured() {
  return Boolean(
    process.env.REX_USERNAME &&
      process.env.REX_PASSWORD_HASH &&
      process.env.JWT_SECRET
  );
}

function signToken() {
  return jwt.sign(
    { user: process.env.REX_USERNAME },
    process.env.JWT_SECRET,
    { expiresIn: `${SESSION_DAYS}d` }
  );
}

/**
 * POST /api/auth/login
 * Verifies the supplied credentials against REX_USERNAME / REX_PASSWORD_HASH
 * (bcrypt, server-side only — never validated in the browser). On success a
 * secure httpOnly JWT cookie is set; the plaintext password is never stored
 * or returned.
 */
router.post("/login", async (req, res) => {
  try {
    if (!isConfigured()) {
      return res.status(500).json({ ok: false, error: "Auth is not configured" });
    }

    const { username, password } = req.body || {};
    const userMatches =
      typeof username === "string" && username === process.env.REX_USERNAME;
    const passwordMatches =
      typeof password === "string" &&
      (await bcrypt.compare(password, process.env.REX_PASSWORD_HASH));

    if (!userMatches || !passwordMatches) {
      return res.status(401).json({ ok: false, error: "Invalid credentials" });
    }

    res.cookie(TOKEN_COOKIE, signToken(), COOKIE_OPTIONS);
    res.json({ ok: true, user: process.env.REX_USERNAME });
  } catch (error) {
    console.error("[Auth] login error:", error.message);
    res.status(500).json({ ok: false, error: "Login failed" });
  }
});

/** POST /api/auth/logout — clears the session cookie. */
router.post("/logout", (req, res) => {
  res.clearCookie(TOKEN_COOKIE, { ...COOKIE_OPTIONS, maxAge: undefined });
  res.json({ ok: true });
});

/** GET /api/auth/me — resolves the current session from the cookie. */
router.get("/me", (req, res) => {
  const token = req.cookies && req.cookies[TOKEN_COOKIE];

  if (!token) {
    return res.status(401).json({ ok: false, authenticated: false });
  }

  try {
    jwt.verify(token, process.env.JWT_SECRET);
    res.json({
      ok: true,
      authenticated: true,
      user: process.env.REX_USERNAME || "admin",
    });
  } catch {
    res.clearCookie(TOKEN_COOKIE, { ...COOKIE_OPTIONS, maxAge: undefined });
    res.status(401).json({ ok: false, authenticated: false });
  }
});

module.exports = router;
