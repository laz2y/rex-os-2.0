/**
 * Fix #1 — Direct Link → pyLoad submission unit tests (mocked pyLoad client).
 *
 * Covers spec scenarios A–F and requirements 1–6, 8 of the task:
 *   1. immediate accept            → accepted
 *   2. definite rejection          → rejected + sanitized reason
 *   3. fail-after-maybe-accepted   → ambiguous + reconciliation attempted
 *   4. reconciliation finds pkg    → accepted / recovered (Ant-Man case)
 *   5. reconciliation finds nothing→ ambiguous
 *   6. same URL twice while pending→ ONE add_package call
 *   8. signed-URL error bodies     → sanitized in logs + client message
 * plus: idempotency TTL lifecycle, ambiguous re-check upgrade, log hygiene.
 *
 * Run: node --test backend/tests/
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const { submitDirectLink } = require("../services/directLinkSubmission");
const {
  createSubmissionRegistry,
} = require("../services/submissionRegistry");

const URL_A = "https://cdn.example.com/movies/Movie.2024.mkv?token=abc123&sig=zz9";
const URL_B = "https://cdn.example.com/movies/Other.2024.mkv";

/** Collects every log line so tests can assert sanitization. */
function makeLog() {
  const lines = [];
  return {
    lines,
    log: (line) => lines.push(String(line)),
    error: (line) => lines.push(String(line)),
  };
}

function httpError(status, data) {
  const error = new Error(`Request failed with status code ${status}`);
  error.response = { status, data };
  return error;
}

function transportError(code) {
  const error = new Error("socket hang up");
  error.code = code;
  error.response = undefined;
  return error;
}

/**
 * Mock pyLoad client. `onAdd({ state, url })` decides the outcome and may
 * push packages into `state.packages` before throwing (Ant-Man behavior).
 */
function makePyLoad(onAdd, { queueFails = false, downloadsFails = false } = {}) {
  const state = { packages: [], downloads: [], addCalls: 0, queueCalls: 0, downloadsCalls: 0, reset: 0 };
  return {
    state,
    async addPackage(url) {
      state.addCalls += 1;
      return onAdd({ state, url });
    },
    async listPackages() {
      state.queueCalls += 1;
      if (queueFails) throw transportError("ECONNRESET");
      return state.packages.map((p) => ({ id: p.pid, name: p.name, links: p.links }));
    },
    async getDownloads() {
      state.downloadsCalls += 1;
      if (downloadsFails) throw transportError("ECONNRESET");
      return state.downloads;
    },
    resetSession() {
      state.reset += 1;
    },
    getBaseUrl() {
      return "http://pyload.local";
    },
  };
}

function fresh(overrides = {}) {
  return {
    registry: createSubmissionRegistry(),
    log: makeLog(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// A / 1 — immediate success
// ---------------------------------------------------------------------------
test("A: pyLoad acknowledges the package → accepted with packageId", async () => {
  const pyLoad = makePyLoad(async ({ state }) => {
    state.packages.push({ pid: 7, name: URL_A, links: [URL_A] });
    return { packageId: 7, packageName: URL_A };
  });
  const { registry, log } = fresh();

  const result = await submitDirectLink(URL_A, { pyLoad, registry, log });

  assert.equal(result.status, "accepted");
  assert.equal(result.ok, true);
  assert.equal(result.packageId, 7);
  assert.equal(result.message, "Added to pyLoad");
  assert.equal(result.recovered, false);
  assert.equal(pyLoad.state.addCalls, 1);
  assert.match(result.fingerprint, /^[0-9a-f]{32}$/);
  assert.ok(log.lines[0].includes("state=accepted"));
});

// ---------------------------------------------------------------------------
// B / 2 — definite rejection
// ---------------------------------------------------------------------------
test("B: pyLoad rejects before creating a package → rejected with safe reason", async () => {
  const pyLoad = makePyLoad(async () => {
    throw httpError(400, { error: "No valid links supplied" });
  });
  const { registry, log } = fresh();

  const result = await submitDirectLink(URL_A, { pyLoad, registry, log });

  assert.equal(result.status, "rejected");
  assert.equal(result.ok, false);
  assert.ok(result.message.startsWith("pyLoad rejected the link:"));
  assert.ok(result.message.includes("No valid links supplied"));
  // Reconciliation ran first and found nothing (Ant-Man rule).
  assert.equal(pyLoad.state.queueCalls, 1);
  assert.equal(pyLoad.state.downloadsCalls, 1);
  assert.equal(result.reconcile, "not-found");
  assert.equal(pyLoad.state.addCalls, 1);
});

// ---------------------------------------------------------------------------
// C / 3 — ambiguous failure, reconciliation attempted
// ---------------------------------------------------------------------------
test("C: response lost after submission → ambiguous after reconciliation", async () => {
  const pyLoad = makePyLoad(async () => {
    throw transportError("ECONNABORTED"); // timeout — no HTTP response at all
  });
  const { registry, log } = fresh();

  const result = await submitDirectLink(URL_A, { pyLoad, registry, log });

  assert.equal(result.status, "ambiguous");
  assert.equal(
    result.message,
    "Submission may have been accepted by pyLoad. Checking status…"
  );
  // Reconciliation WAS attempted (queue + downloads) and found nothing.
  assert.ok(pyLoad.state.queueCalls >= 1);
  assert.ok(pyLoad.state.downloadsCalls >= 1);
  assert.equal(result.reconcile, "not-found");
  // Crucially: add_package was NOT re-posted.
  assert.equal(pyLoad.state.addCalls, 1);
});

// ---------------------------------------------------------------------------
// D / 4 — reconciliation finds the package (live Ant-Man behavior)
// ---------------------------------------------------------------------------
test("D: HTTP 502 after pyLoad created the package → accepted/recovered", async () => {
  const pyLoad = makePyLoad(async ({ state }) => {
    // pyLoad creates + starts the package, then the response comes back 502.
    state.packages.push({ pid: 42, name: URL_A, links: [URL_A] });
    throw httpError(502, "<html>Bad Gateway</html>");
  });
  const { registry, log } = fresh();

  const result = await submitDirectLink(URL_A, { pyLoad, registry, log });

  assert.equal(result.status, "accepted");
  assert.equal(result.recovered, true);
  assert.equal(result.packageId, 42);
  assert.equal(result.message, "Added to pyLoad");
  assert.equal(result.reconcile, "found:queue");
  assert.equal(pyLoad.state.addCalls, 1);
  assert.ok(log.lines[0].includes("reconcile=found:queue"));
});

test("D2: HTTP 400 recorded but the package exists → accepted/recovered (never auto-rejected)", async () => {
  const pyLoad = makePyLoad(async ({ state }) => {
    state.packages.push({ pid: 9, name: URL_A, links: [URL_A] });
    throw httpError(400, { error: "Request failed with status code 400" });
  });
  const { registry, log } = fresh();

  const result = await submitDirectLink(URL_A, { pyLoad, registry, log });

  assert.equal(result.status, "accepted");
  assert.equal(result.recovered, true);
  assert.equal(result.packageId, 9);
});

test("D3: package already STARTED (only visible in status_downloads) → recovered via downloads", async () => {
  const pyLoad = makePyLoad(async () => {
    throw transportError("ECONNRESET");
  });
  pyLoad.state.downloads = [
    { fid: 1, name: "chunk0", package: URL_A, packageId: 5, state: "downloading" },
  ];
  const { registry, log } = fresh();

  const result = await submitDirectLink(URL_A, { pyLoad, registry, log });

  assert.equal(result.status, "accepted");
  assert.equal(result.recovered, true);
  assert.equal(result.packageId, 5);
  assert.equal(result.reconcile, "found:downloads");
});

// ---------------------------------------------------------------------------
// E / 5 — reconciliation cannot determine the outcome
// ---------------------------------------------------------------------------
test("E: submission fails and reconciliation itself fails → ambiguous", async () => {
  const pyLoad = makePyLoad(async () => transportThrow(), {
    queueFails: true,
    downloadsFails: true,
  });
  function transportThrow() {
    throw transportError("ETIMEDOUT");
  }
  const { registry, log } = fresh();

  const result = await submitDirectLink(URL_A, { pyLoad, registry, log });

  assert.equal(result.status, "ambiguous");
  assert.equal(result.reconcile, "unavailable");
  assert.equal(pyLoad.state.addCalls, 1);
});

// ---------------------------------------------------------------------------
// F / 6 — duplicate request while pending: exactly ONE add_package call
// ---------------------------------------------------------------------------
test("F: same URL submitted twice while pending → one add_package call", async () => {
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  const pyLoad = makePyLoad(async ({ state }) => {
    await gate; // keep the first submission in flight
    state.packages.push({ pid: 3, name: URL_A, links: [URL_A] });
    return { packageId: 3, packageName: URL_A };
  });
  const { registry, log } = fresh();

  const first = submitDirectLink(URL_A, { pyLoad, registry, log });
  const second = submitDirectLink(URL_A, { pyLoad, registry, log }); // double click
  release();

  const [r1, r2] = await Promise.all([first, second]);

  assert.equal(pyLoad.state.addCalls, 1, "add_package must run exactly once");
  assert.equal(r1.status, "accepted");
  assert.equal(r2.status, "accepted");
  assert.equal(r2.duplicate, true);
});

test("F2: repeated submit after accepted (inside TTL) → served from registry", async () => {
  const pyLoad = makePyLoad(async () => ({ packageId: 1, packageName: URL_A }));
  const { registry, log } = fresh();

  const first = await submitDirectLink(URL_A, { pyLoad, registry, log });
  const again = await submitDirectLink(URL_A, { pyLoad, registry, log });

  assert.equal(pyLoad.state.addCalls, 1);
  assert.equal(first.status, "accepted");
  assert.equal(again.status, "accepted");
  assert.equal(again.duplicate, true);
});

test("F3: a DIFFERENT URL is not blocked by another URL's protection", async () => {
  const pyLoad = makePyLoad(async () => ({ packageId: 1, packageName: "x" }));
  const { registry, log } = fresh();

  await submitDirectLink(URL_A, { pyLoad, registry, log });
  await submitDirectLink(URL_B, { pyLoad, registry, log });

  assert.equal(pyLoad.state.addCalls, 2);
});

test("F4: duplicate of an AMBIGUOUS submission re-reconciles only — never add_package", async () => {
  const pyLoad = makePyLoad(async () => {
    throw transportError("ECONNABORTED");
  });
  const { registry, log } = fresh();

  const first = await submitDirectLink(URL_A, { pyLoad, registry, log });
  assert.equal(first.status, "ambiguous");
  assert.equal(pyLoad.state.addCalls, 1);

  // Nothing yet → still ambiguous, still no second add.
  const second = await submitDirectLink(URL_A, { pyLoad, registry, log });
  assert.equal(second.status, "ambiguous");
  assert.equal(second.duplicate, true);
  assert.equal(pyLoad.state.addCalls, 1);

  // The package shows up later (pyLoad really did accept it) → re-check
  // upgrades the stored result to accepted/recovered without re-posting.
  pyLoad.state.packages.push({ pid: 8, name: URL_A, links: [URL_A] });
  const third = await submitDirectLink(URL_A, { pyLoad, registry, log });
  assert.equal(third.status, "accepted");
  assert.equal(third.recovered, true);
  assert.equal(third.packageId, 8);
  assert.equal(pyLoad.state.addCalls, 1);
});

test("F5: protection expires with the TTL — old URLs can be re-downloaded", async () => {
  const pyLoad = makePyLoad(async () => ({ packageId: 1, packageName: URL_A }));
  let clock = 1_000_000;
  const registry = createSubmissionRegistry({
    ttls: { accepted: 60_000, ambiguous: 60_000, rejected: 1_000 },
    now: () => clock,
  });
  const log = makeLog();

  await submitDirectLink(URL_A, { pyLoad, registry, log });
  await submitDirectLink(URL_A, { pyLoad, registry, log });
  assert.equal(pyLoad.state.addCalls, 1, "protected inside the TTL");

  clock += 120_000; // past the accepted TTL (months later, same URL)
  await submitDirectLink(URL_A, { pyLoad, registry, log });
  assert.equal(pyLoad.state.addCalls, 2, "re-download allowed after expiry");
});

// ---------------------------------------------------------------------------
// 8 — sanitization of error responses + logs
// ---------------------------------------------------------------------------
test("8: signed URLs/tokens in pyLoad error bodies never reach logs or the client", async () => {
  const SIGNED = "SIGNEDSECRET999";
  const pyLoad = makePyLoad(async () => {
    throw httpError(400, {
      error: `Invalid link: https://cdn.example.com/f.mkv?token=${SIGNED}&sig=aabbcc csrf_token=CSRFTOPSECRET`,
    });
  });
  const { registry, log } = fresh();

  const result = await submitDirectLink(URL_A, { pyLoad, registry, log });

  assert.equal(result.status, "rejected");
  const everything = `${result.message}\n${result.reason}\n${log.lines.join("\n")}`;
  assert.ok(!everything.includes(SIGNED), "signed query must be redacted");
  assert.ok(!everything.includes("CSRFTOPSECRET"), "csrf token must be redacted");
  assert.ok(log.lines.join("\n").includes("fp="), "fingerprint correlates logs");
  // The full signed URL must never appear in logs.
  for (const line of log.lines) {
    assert.ok(!line.includes(URL_A), "full signed URL must never be logged");
  }
});

test("logs never contain the full submitted URL on success either", async () => {
  const pyLoad = makePyLoad(async () => ({ packageId: 1, packageName: URL_A }));
  const { registry, log } = fresh();

  await submitDirectLink(URL_A, { pyLoad, registry, log });
  assert.ok(!log.lines.join("\n").includes(URL_A));
});

// ---------------------------------------------------------------------------
// 9 — normal successful behavior is preserved
// ---------------------------------------------------------------------------
test("9: contract fields for a normal success are backward compatible", async () => {
  const pyLoad = makePyLoad(async () => ({ packageId: 11, packageName: URL_B }));
  const { registry, log } = fresh();

  const result = await submitDirectLink(URL_B, { pyLoad, registry, log });

  assert.equal(result.status, "accepted");
  assert.equal(result.ok, true);
  assert.equal(result.packageId, 11);
  assert.equal(result.packageName, URL_B);
  assert.equal(result.message, "Added to pyLoad");
  assert.equal(result.fingerprint.length, 32);
});

// ---------------------------------------------------------------------------
// Pre-flight failures (provably never reached pyLoad)
// ---------------------------------------------------------------------------
test("connection refused (never reached pyLoad) → rejected with clear message", async () => {
  const pyLoad = makePyLoad(async () => {
    throw transportError("ECONNREFUSED");
  });
  const { registry, log } = fresh();

  const result = await submitDirectLink(URL_A, { pyLoad, registry, log });

  assert.equal(result.status, "rejected");
  assert.ok(result.message.includes("refused the connection"));
  assert.equal(result.reconcile, "skipped");
  assert.equal(pyLoad.state.queueCalls, 0, "no reconcile needed when not sent");
});

test("credential rejection → rejected + session reset (no package possible)", async () => {
  const pyLoad = makePyLoad(async () => {
    throw httpError(401, { error: "Unauthorized" });
  });
  const { registry, log } = fresh();

  const result = await submitDirectLink(URL_A, { pyLoad, registry, log });

  assert.equal(result.status, "rejected");
  assert.ok(result.message.includes("PYLOAD_USERNAME"));
  assert.equal(pyLoad.state.reset, 1);
});
