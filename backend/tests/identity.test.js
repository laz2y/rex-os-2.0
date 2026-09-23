/**
 * Fix #1 — URL fingerprint / normalization / sanitization unit tests.
 * Run: node --test backend/tests/
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeUrl,
  fingerprintUrl,
  packageNameFor,
  sanitizeText,
} = require("../services/submissionIdentity");

test("fingerprint is deterministic for the same URL", () => {
  const a = fingerprintUrl("https://example.com/files/movie.mkv");
  const b = fingerprintUrl("https://example.com/files/movie.mkv");
  assert.equal(a, b);
  assert.match(a, /^[0-9a-f]{32}$/);
});

test("fingerprint differs for different resources", () => {
  const a = fingerprintUrl("https://example.com/files/a.mkv");
  const b = fingerprintUrl("https://example.com/files/b.mkv");
  assert.notEqual(a, b);
});

test("signed query parameters are NOT stripped — they identify the request", () => {
  const base = "https://cdn.example.com/movie.mkv";
  const withTokenA = fingerprintUrl(`${base}?token=AAAA`);
  const withTokenB = fingerprintUrl(`${base}?token=BBBB`);
  assert.notEqual(withTokenA, withTokenB);

  // Parameter order is semantic too — never re-sorted.
  const order1 = fingerprintUrl(`${base}?a=1&b=2`);
  const order2 = fingerprintUrl(`${base}?b=2&a=1`);
  assert.notEqual(order1, order2);
});

test("normalization does not change URL semantics", () => {
  // Trailing whitespace ignored.
  assert.equal(
    normalizeUrl("  https://example.com/a.mkv  "),
    "https://example.com/a.mkv"
  );
  // Scheme/host casing is irrelevant.
  assert.equal(
    fingerprintUrl("HTTPS://EXAMPLE.COM/a.mkv"),
    fingerprintUrl("https://example.com/a.mkv")
  );
  // Fragments are client-only — never sent to the server.
  assert.equal(
    fingerprintUrl("https://example.com/a.mkv#part1"),
    fingerprintUrl("https://example.com/a.mkv#part2")
  );
  // Bare origin gets the default "/" — equivalent request.
  assert.equal(
    fingerprintUrl("https://example.com"),
    fingerprintUrl("https://example.com/")
  );
  // Path differences ARE meaningful.
  assert.notEqual(
    fingerprintUrl("https://example.com/a.mkv"),
    fingerprintUrl("https://example.com/b.mkv")
  );
});

test("packageNameFor matches the proven pyLoad label (URL ≤ 200 chars)", () => {
  assert.equal(packageNameFor("https://e.com/a"), "https://e.com/a");
  const long = `https://e.com/${"x".repeat(400)}`;
  assert.equal(packageNameFor(long).length, 200);
});

test("sanitizeText strips query strings, secrets and JWTs", () => {
  const dirty =
    "Invalid link: https://cdn.example.com/f.mkv?token=SIGNEDSECRET999&sig=aabbcc " +
    "also csrf_token=TOPSECRET password: hunter22 " +
    "eyJhbGciOiJIUzI1NiJ9.abcdefghijklmnopqrstuvwxyz012345.abcdefghijklmnop";

  const clean = sanitizeText(dirty);

  assert.ok(!clean.includes("SIGNEDSECRET999"), "signed URL query must be gone");
  assert.ok(!clean.includes("TOPSECRET"), "csrf token must be gone");
  assert.ok(!clean.includes("hunter22"), "password must be gone");
  assert.ok(clean.includes("https://cdn.example.com/f.mkv"), "path is kept for context");
  assert.ok(clean.includes("[redacted]"));

  // Robust on odd input.
  assert.equal(sanitizeText(null), "");
  assert.equal(sanitizeText(undefined), "");
  assert.ok(sanitizeText("x".repeat(1000)).length <= 301);
});
