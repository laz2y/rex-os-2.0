/**
 * Fix #1 — pyLoad session single-flight + status semantics (scenarios A, H).
 *
 * Uses an in-process mock pyLoad HTTP server (no live NAS). Verifies:
 *   - concurrent cold-session calls trigger exactly ONE /login;
 *   - both concurrent calls succeed on the shared session;
 *   - a FAILED login clears the in-flight promise so the next request retries;
 *   - status_downloads [] ⇒ reachable, no active downloads (not "unreachable");
 *   - transport failure ⇒ unreachable (503);
 *   - auth failure ⇒ distinct authentication error.
 *
 * Run: node --test backend/tests/
 */

const test = require("node:test");
const { before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

const { createMockPyLoad } = require("./helpers/mockPyLoadServer");
const pyLoad = require("../services/pyLoadService");

const savedEnv = {
  PYLOAD_URL: process.env.PYLOAD_URL,
  PYLOAD_USERNAME: process.env.PYLOAD_USERNAME,
  PYLOAD_PASSWORD: process.env.PYLOAD_PASSWORD,
};

let mock = null;

before(async () => {
  // Use the FAKE development fallback credentials (admin / za2yrocks).
  delete process.env.PYLOAD_USERNAME;
  delete process.env.PYLOAD_PASSWORD;
  mock = createMockPyLoad();
  process.env.PYLOAD_URL = await mock.listen();
  pyLoad.resetSession();
});

after(async () => {
  if (mock) await mock.close();
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

beforeEach(() => {
  pyLoad.resetSession();
});

// ---------------------------------------------------------------------------
// Scenario A — single-flight login
// ---------------------------------------------------------------------------
test("A: two concurrent cold-session calls → exactly ONE login, both succeed", async () => {
  mock.state.loginCount = 0;

  const [downloads, version] = await Promise.all([
    pyLoad.getDownloads(),
    pyLoad.probe(),
  ]);

  assert.equal(mock.state.loginCount, 1, "exactly one login for the race");
  assert.ok(Array.isArray(downloads));
  assert.equal(typeof version, "string");
});

test("A2: three concurrent cold-session callers share the same login", async () => {
  mock.state.loginCount = 0;

  const [a, b, c] = await Promise.all([
    pyLoad.getDownloads(),
    pyLoad.getQueueData(),
    pyLoad.getCollectorData(),
  ]);

  assert.equal(mock.state.loginCount, 1);
  assert.ok(Array.isArray(a) && Array.isArray(b) && Array.isArray(c));
});

test("A3: failed login clears the in-flight promise; retry succeeds", async () => {
  mock.state.loginCount = 0;
  const correctPassword = mock.state.password;

  // Sabotage credentials so the (single-flight) login fails.
  mock.state.password = "wrong-password-during-test";
  await assert.rejects(() => pyLoad.getDownloads());
  assert.equal(mock.state.loginCount, 1, "one failed login attempt");

  // A retry after the failure starts a FRESH login (promise was cleared).
  mock.state.password = correctPassword;
  const downloads = await pyLoad.getDownloads();
  assert.equal(mock.state.loginCount, 2, "retry performed a new login");
  assert.ok(Array.isArray(downloads));
});

test("A4: warm session performs no additional logins", async () => {
  await pyLoad.getDownloads();
  mock.state.loginCount = 0;

  await pyLoad.getDownloads();
  await pyLoad.getDownloads();

  assert.equal(mock.state.loginCount, 0, "cached session reused");
});

// ---------------------------------------------------------------------------
// Scenario H — status semantics (reachable ≠ has downloads)
// ---------------------------------------------------------------------------
test("H: status_downloads [] → reachable, no active downloads", async () => {
  mock.state.queue = [];
  const downloads = await pyLoad.getDownloads();
  assert.equal(downloads.length, 0);

  // Controller-level: an empty list is a SUCCESS response, not an error.
  const controller = require("../controllers/pyLoadController");
  const res = {
    statusCode: 200,
    body: null,
    status(c) { this.statusCode = c; return this; },
    json(p) { this.body = p; return this; },
  };
  await controller.getStatus({}, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.deepEqual(res.body.downloads, []);
});

test("H2: transport failure → unreachable (503), not an empty success", async () => {
  // Point the service at a dead port to simulate pyLoad being down.
  const savedUrl = process.env.PYLOAD_URL;
  pyLoad.resetSession();
  process.env.PYLOAD_URL = "http://127.0.0.1:9"; // discard port — nothing listens

  const controller = require("../controllers/pyLoadController");
  const res = {
    statusCode: 200,
    body: null,
    status(c) { this.statusCode = c; return this; },
    json(p) { this.body = p; return this; },
  };
  await controller.getStatus({}, res);

  assert.equal(res.statusCode, 503);
  assert.equal(res.body.ok, false);
  assert.match(res.body.error, /unreachable|refused|did not respond/i);

  process.env.PYLOAD_URL = savedUrl;
  pyLoad.resetSession();
});

test("H3: auth failure → distinct authentication error message", async () => {
  mock.state.password = "definitely-not-the-password";
  pyLoad.resetSession();

  const controller = require("../controllers/pyLoadController");
  const res = {
    statusCode: 200,
    body: null,
    status(c) { this.statusCode = c; return this; },
    json(p) { this.body = p; return this; },
  };
  await controller.getStatus({}, res);

  assert.equal(res.statusCode, 503);
  assert.equal(res.body.ok, false);
  assert.match(res.body.error, /credentials/i);

  mock.state.password = "za2yrocks"; // restore fake dev credential
  pyLoad.resetSession();
});
