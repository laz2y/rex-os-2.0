/**
 * Fix #1 — end-to-end submission tests through the REAL pyLoad client
 * against an in-process mock pyLoad 0.5.x server (no live NAS involved).
 *
 * Exercises: controller → orchestrator → registry → axios → mock pyLoad,
 * including the web-UI login/CSRF flow with the preserved FAKE dev
 * credentials (admin / za2yrocks fallback).
 *
 * Run: node --test backend/tests/
 */

const test = require("node:test");
const { before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

const { createMockPyLoad } = require("./helpers/mockPyLoadServer");
const controller = require("../controllers/pyLoadController");
const { submissions } = require("../services/submissionRegistry");
const pyLoadService = require("../services/pyLoadService");

// Preserve whatever the environment had; fake dev creds must stay in play.
const savedEnv = {
  PYLOAD_URL: process.env.PYLOAD_URL,
  PYLOAD_USERNAME: process.env.PYLOAD_USERNAME,
  PYLOAD_PASSWORD: process.env.PYLOAD_PASSWORD,
};

let mock = null;

before(async () => {
  // Ensure the FAKE development fallbacks (admin / za2yrocks) are what the
  // service uses — the mock server validates exactly those.
  delete process.env.PYLOAD_USERNAME;
  delete process.env.PYLOAD_PASSWORD;
  mock = createMockPyLoad();
  process.env.PYLOAD_URL = await mock.listen();
  pyLoadService.resetSession();
});

after(async () => {
  if (mock) await mock.close();
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

beforeEach(() => {
  submissions.clear();
});

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

async function add(url) {
  const res = mockRes();
  await controller.addLink({ body: { url } }, res);
  return res;
}

test("9: normal Direct Link success through the full stack → accepted", async () => {
  mock.state.addMode = "accept";
  const url = "https://files.example.com/normal/Success.2024.mkv";

  const res = await add(url);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.status, "accepted");
  assert.equal(res.body.message, "Added to pyLoad");
  assert.equal(res.body.packageName, url);
  // Raw URL is no longer returned; only the sanitized display value is.
  assert.equal(res.body.url, undefined);
  assert.equal(res.body.displayUrl, "https://files.example.com/normal/Success.2024.mkv");
  assert.match(res.body.fingerprint, /^[0-9a-f]{32}$/);
  assert.equal(typeof res.body.packageId, "number");
  assert.equal(mock.state.addCalls, 1);
});

test("10: fake/demo credentials remain intact and are what gets used", () => {
  const last = mock.state.loginAttempts[mock.state.loginAttempts.length - 1];
  assert.ok(last, "a login attempt was recorded");
  assert.equal(last.username, "admin", "PYLOAD_USERNAME fallback preserved");
  assert.equal(last.password, "za2yrocks", "PYLOAD_PASSWORD fallback preserved");
  assert.equal(process.env.PYLOAD_USERNAME, undefined, "no real creds injected");
  assert.equal(process.env.PYLOAD_PASSWORD, undefined, "no real creds injected");
});

test("2/B: explicit validation 400 + no package → structured rejected (e2e)", async () => {
  mock.state.addMode = "reject";
  mock.state.rejectReason = "No valid links supplied";
  const url = "https://files.example.com/rejected/Bad.Link.mkv";

  const res = await add(url);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, false);
  assert.equal(res.body.status, "rejected");
  assert.ok(res.body.message.startsWith("pyLoad rejected the link:"));
  assert.ok(res.body.message.includes("No valid links supplied"));
  assert.equal(res.body.error, res.body.message); // legacy .error alias
  assert.equal(res.body.url, undefined); // no raw URL in responses
  assert.equal(mock.state.addCalls, 2, "one add attempt per submission");
});

test("A: generic HTTP 400 'Bad Request' + no package → ambiguous (e2e)", async () => {
  mock.state.addMode = "reject";
  mock.state.rejectReason = "Bad Request"; // generic — proves nothing
  const url = "https://files.example.com/generic400/Generic.Error.mkv";

  const res = await add(url);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, false);
  assert.equal(res.body.status, "ambiguous");
  assert.equal(
    res.body.message,
    "Submission may have been accepted by pyLoad. Checking status…"
  );
  assert.equal(mock.state.addCalls, 3, "one attempt; not re-posted");
});

test("C: HTTP 400 + package actually exists → accepted/recovered (e2e)", async () => {
  // Mock creates the package first, then answers 400 — the Ant-Man variant
  // with a validation-status code instead of a gateway error.
  mock.state.addMode = "accept-then-400";
  const url = "https://files.example.com/ant400/Created.But.400.mkv?token=secrettoken77";

  const res = await add(url);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.status, "accepted");
  assert.equal(res.body.recovered, true);
  assert.equal(typeof res.body.packageId, "number");
  // The raw URL is no longer returned as its own `url` field, and the
  // display value carries no query/fragment. (`packageName` is pyLoad's own
  // package label — the proven { name: <URL> } schema — and is required by
  // the existing Direct Link page for display and name-matching against
  // pyLoad's status rows; the submitter already knows the URL they pasted.)
  assert.equal(res.body.url, undefined, "no raw url field in the response");
  assert.ok(
    !res.body.displayUrl.includes("?"),
    "displayUrl must have its query stripped"
  );
  assert.equal(res.body.displayUrl, "https://files.example.com/ant400/Created.But.400.mkv");
});

test("D: Ant-Man case — package created, response is HTTP 502 → recovered", async () => {
  mock.state.addMode = "accept-then-502";
  const url =
    "https://cdn.example.com/ant/AntMan.The.Wasp.2018.1080p.mkv?token=signed123&sig=abc";

  const res = await add(url);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.status, "accepted");
  assert.equal(res.body.ok, true);
  assert.equal(res.body.recovered, true);
  assert.equal(res.body.message, "Added to pyLoad");
  assert.equal(typeof res.body.packageId, "number");
  assert.equal(mock.state.addCalls, 5, "never re-posted add_package");
  // The signed URL must not leak into anything server-side (checked in unit
  // tests for logs); the client response only echoes what the client sent.
});

test("3: response lost entirely (socket dropped) → ambiguous, no retry", async () => {
  mock.state.addMode = "drop";
  const url = "https://files.example.com/dropped/No.Response.mkv";
  const before = mock.state.addCalls;

  const res = await add(url);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, false);
  assert.equal(res.body.status, "ambiguous");
  assert.equal(
    res.body.message,
    "Submission may have been accepted by pyLoad. Checking status…"
  );
  assert.equal(mock.state.addCalls, before + 1, "exactly one attempt");

  // Submitting again while ambiguous must NOT re-post add_package — it
  // reconciles (queue empty here) and repeats the ambiguous outcome.
  const res2 = await add(url);
  assert.equal(res2.body.status, "ambiguous");
  assert.equal(res2.body.duplicate, true);
  assert.equal(mock.state.addCalls, before + 1, "still exactly one attempt");
});

test("6+7: double click — two concurrent requests, ONE add_package", async () => {
  mock.state.addMode = "accept";
  const url = "https://files.example.com/race/Double.Click.mkv";
  const before = mock.state.addCalls;

  const [r1, r2] = await Promise.all([add(url), add(url)]);

  assert.equal(r1.statusCode, 200);
  assert.equal(r2.statusCode, 200);
  assert.equal(r1.body.status, "accepted");
  assert.equal(r2.body.status, "accepted");
  assert.equal(mock.state.addCalls, before + 1, "single add despite double click");
  assert.equal([r1.body, r2.body].filter((b) => b.duplicate).length, 1);
});

test("validation errors keep their original 400 contract", async () => {
  const empty = await add("   ");
  assert.equal(empty.statusCode, 400);
  assert.equal(empty.body.ok, false);

  const bad = await add("not-a-url");
  assert.equal(bad.statusCode, 400);
});
