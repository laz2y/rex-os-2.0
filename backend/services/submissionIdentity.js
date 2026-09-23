/**
 * Submission identity + sanitization helpers (REX OS v2.5.0 Fix #1).
 *
 * A Direct Link submission is identified by a cryptographic fingerprint of
 * the normalized URL. The fingerprint is INTERNAL only — it is used for
 * duplicate detection, pending-submission tracking, reconciliation and
 * diagnostic correlation. The full (possibly signed) URL is never logged.
 *
 * Normalization rules (must NOT change URL semantics):
 *   - trim surrounding whitespace
 *   - parse with the WHATWG URL parser (lowercases scheme + host, adds the
 *     default "/" path, removes the default port)
 *   - drop the "#fragment" (never sent to the server, so it cannot identify
 *     the resource server-side)
 *   - keep the path EXACTLY as given (no trailing-slash fiddling, no
 *     percent-encoding changes, no slash collapsing)
 *   - keep the query string EXACTLY as given — signed URLs rely on their
 *     parameters, including their order and encoding. Query params are
 *     NEVER stripped or re-sorted.
 */

const crypto = require("crypto");

/** Matches the `name` field REX has always sent to pyLoad's add_package. */
const PACKAGE_NAME_LIMIT = 200;

/** Deterministic, semantics-preserving URL normalization. */
function normalizeUrl(raw) {
  const trimmed = String(raw == null ? "" : raw).trim();
  try {
    const parsed = new URL(trimmed);
    parsed.hash = ""; // fragments are client-only — they never reach pyLoad
    // URL#toString() lowercases scheme/host, normalizes the default port and
    // ensures a "/" path. Query is left untouched on purpose.
    return parsed.toString();
  } catch {
    // Not parseable — fall back to the trimmed input so identity still works.
    return trimmed;
  }
}

/**
 * SHA-256 fingerprint of the normalized URL (first 32 hex chars = 128 bits).
 * Internal use only; safe to log and to return to the calling browser.
 */
function fingerprintUrl(raw) {
  return crypto
    .createHash("sha256")
    .update(normalizeUrl(raw))
    .digest("hex")
    .slice(0, 32);
}

/** The neutral package label REX sends to pyLoad (URL, truncated). */
function packageNameFor(raw) {
  const trimmed = String(raw == null ? "" : raw).trim();
  return trimmed.length > PACKAGE_NAME_LIMIT
    ? trimmed.slice(0, PACKAGE_NAME_LIMIT)
    : trimmed;
}

/**
 * Sanitize free-form text (pyLoad error bodies, axios messages) before it is
 * logged or returned to the browser:
 *   - every http(s) URL loses its query string / fragment (signed credentials)
 *   - secret-looking key=value / key: value pairs are redacted
 *   - JWTs are redacted
 *   - output is length-capped
 */
function sanitizeText(value) {
  if (value == null) return "";
  let text = String(value);

  // URLs: keep origin+path, redact ?query / #fragment entirely.
  text = text.replace(
    /(https?:\/\/[^\s"'<>#?]+)([?#][^\s"'<>]*)?/g,
    (match, base, query) => (query ? `${base}?[redacted]` : match)
  );

  // Secret-ish key/value pairs (query-style and header-style).
  text = text.replace(
    /\b(csrf[_-]?token|xsrf[_-]?token|access[_-]?token|refresh[_-]?token|token|api[_-]?key|apikey|password|passwd|pwd|secret|signature|sig|authorization|auth|cookie|set-cookie|session[_-]?(?:id|token)?)\b(\s*[=:]\s*)(?:"[^"]*"|'[^']*'|[^\s,;&"']+)/gi,
    "$1$2[redacted]"
  );

  // JWT-shaped strings anywhere in the text.
  text = text.replace(
    /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
    "[redacted-jwt]"
  );

  if (text.length > 300) text = `${text.slice(0, 300)}…`;
  return text;
}

/**
 * Sanitized, URL-like display value for API responses: origin + path with the
 * query string and fragment removed. The raw signed URL never leaves the
 * server; correlation uses the fingerprint.
 */
function sanitizeUrlForDisplay(raw) {
  try {
    const parsed = new URL(String(raw == null ? "" : raw).trim());
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return "";
  }
}

/**
 * Human-safe display name (Fix #1 package-name leak protection). The pyLoad
 * package label is the submitted URL (possibly signed) — never return it raw.
 * Priority: Content-Disposition filename → resolved filename → safe URL-path
 * basename → neutral fallback.
 */
function safeDisplayName({ contentDisposition, resolvedName, url } = {}) {
  // 1) Content-Disposition: filename="..." / filename*=UTF-8''...
  if (contentDisposition) {
    const star = String(contentDisposition).match(
      /filename\*=UTF-8''([^;]+)/i
    );
    if (star && star[1].trim()) {
      try {
        return decodeURIComponent(star[1].trim()).slice(0, 150);
      } catch {
        /* fall through to plain filename */
      }
    }
    const plain = String(contentDisposition).match(/filename\s*=\s*(?:"([^"]*)"|([^;]+))/i);
    const value = plain && (plain[1] ?? plain[2]);
    if (value && String(value).trim()) {
      return String(value).trim().replace(/^"|"$/g, "").slice(0, 150);
    }
  }

  // 2) pyLoad's resolved filename (a real file name, not the URL).
  if (resolvedName && String(resolvedName).trim()) {
    const name = String(resolvedName).trim();
    if (!name.includes("?") && !name.includes("&")) return name.slice(0, 150);
  }

  // 3) Safe basename of the final URL path (query already excluded).
  try {
    const parsed = new URL(String(url == null ? "" : url).trim());
    const base = decodeURIComponent(parsed.pathname.split("/").pop() || "");
    if (base && base !== "/" && !base.includes("?")) return base.slice(0, 150);
  } catch {
    /* not a URL — fall through */
  }

  // 4) Neutral fallback.
  return "Direct download";
}

module.exports = {
  PACKAGE_NAME_LIMIT,
  normalizeUrl,
  fingerprintUrl,
  packageNameFor,
  sanitizeText,
  sanitizeUrlForDisplay,
  safeDisplayName,
};
