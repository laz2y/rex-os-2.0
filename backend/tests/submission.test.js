/**
 * Fix #1 — Direct Link submission orchestrator unit tests (mocked pyLoad
 * client + stubbed preflight). Scenarios C, D, E, F, G.
 *
 * Reconciliation contract implemented by services/directLinkSubmission.js:
 *   1. getQueueData      (packages[].links[].url exact/normalized match)
 *   2. getCollectorData  (same; accepted downloads park here after leaving
 *                         active status)
 *   3. getDownloads      (package_id + conservative name evidence, confirmed
 *                         via getPackageData detail when a pid exists)
 *   4. getPackageData    (read-only detail confirmation)
 *
 * Run: node --test backend/tests/
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const { submitDirectLink, urlsMatch } = require("../services/directLinkSubmission");
const { createSubmissionRegistry } = require("../services/submissionRegistry");
const { safeDisplayName } = require("../services/submissionIdentity");

const URL_A =
  "https://acct.r2.cloudflarestorage.com/bucket/Movie.2024.1080p.mkv?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=aa11&X-Amz-Expires=604800";
const URL_B = "https://cdn.example.com/movies/Other.2024.mkv";
const PATH_BASE = "Movie.2024.1080p.mkv";

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

const SKIP_PREFLIGHT = { preflightFn: async () => ({ verdict: "uncertain", reason: "stubbed" }) };

/**
 * Mock pyLoad client with the verified 0.5.x data shapes.
 * `onAdd({ state, url })` decides the add_package outcome and may push
 * packages BEFORE throwing (Ant-Man behavior).
 */
function makePyLoad(onAdd, { queueFails = false, collectorFails = false, downloadsFails = false } = {}) {
  const state = {
    queue: [], // [{ pid, name, links: [{ url, name }] }]
    collector: [],
    downloads: [], // [{ fid, name, package, packageId }]
    addCalls: 0,
    queueCalls: 0,
    collectorCalls: 0,
    downloadsCalls: 0,
    detailCalls: 0,
    mutateCalls: 0,
    reset: 0,
  };
  return {
    state,
    async addPackage(url) {
      state.addCalls += 1;
      return onAdd({ state, url });
    },
    async getQueueData() {
      state.queueCalls += 1;
      if (queueFails) throw transportError("ECONNRESET");
      return state.queue;
    },
    async getCollectorData() {
      state.collectorCalls += 1;
      if (collectorFails) throw transportError("ECONNRESET");
      return state.collector;
    },
    async getDownloads() {
      state.downloadsCalls += 1;
      if (downloadsFails) throw transportError("ECONNRESET");
      return state.downloads;
    },
    async getPackageData(pid) {
      state.detailCalls += 1;
      // Service-mapped shape: { id, name, links: [{ url, name }] }.
      const pkg = [...state.queue, ...state.collector].find((p) => p.id === pid);
      return pkg || null;
    },
    async getFileData() {
      state.detailCalls += 1;
      return null;
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
    ...SKIP_PREFLIGHT,
    ...overrides,
  };
}

function queuePkg(pid, url) {
  // Service-mapped shape returned by pyLoadService.getQueueData /
  // getCollectorData / getPackageData: { id, name, links: [{ url, name }] }.
  return { id: pid, name: `pkg-${pid}`, links: [{ url, name: PATH_BASE }] };
}

// ---------------------------------------------------------------------------
// C — submission outcomes
// ---------------------------------------------------------------------------
test("C: add_package returns pid → accepted with packageId and leak-safe displayName", async () => {
  const pyLoad = makePyLoad(async ({ state, url }) => {
    state.queue.push(queuePkg(7, url));
    return { packageId: 7, packageName: url };
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
  assert.equal(result.displayName, PATH_BASE); // path basename, NOT the signed URL
  assert.ok(!result.displayName.includes("X-Amz"));
  assert.ok(log.lines[0].includes("state=accepted"));
});

test("C2: accepted result does not wait for download completion", async () => {
  const pyLoad = makePyLoad(async () => ({ packageId: 3, packageName: URL_A }));
  const { registry, log } = fresh();

  const result = await submitDirectLink(URL_A, { pyLoad, registry, log });

  // No reconciliation or download polling happened on the happy path.
  assert.equal(pyLoad.state.queueCalls, 0);
  assert.equal(pyLoad.state.downloadsCalls, 0);
  assert.equal(result.status, "accepted");
});

// ---------------------------------------------------------------------------
// D — reconciliation scenarios
// ---------------------------------------------------------------------------
test("D: ambiguous + matching URL in queue_data → accepted/recovered", async () => {
  const pyLoad = makePyLoad(async ({ state, url }) => {
    state.queue.push(queuePkg(21, url)); // pyLoad created it…
    throw transportError("ECONNRESET"); // …then the response was lost
  });
  const { registry, log } = fresh();

  const result = await submitDirectLink(URL_A, { pyLoad, registry, log });

  assert.equal(result.status, "accepted");
  assert.equal(result.recovered, true);
  assert.equal(result.packageId, 21);
  assert.equal(result.reconcile, "found:queue_data");
  assert.equal(pyLoad.state.addCalls, 1, "never re-posted");
});

test("D2: queue empty + matching URL in collector_data → accepted/recovered", async () => {
  const pyLoad = makePyLoad(async ({ state, url }) => {
    state.collector.push(queuePkg(33, url)); // parked in the collector
    throw httpError(502, "<html>gateway</html>");
  });
  const { registry, log } = fresh();

  const result = await submitDirectLink(URL_A, { pyLoad, registry, log });

  assert.equal(result.status, "accepted");
  assert.equal(result.recovered, true);
  assert.equal(result.packageId, 33);
  assert.equal(result.reconcile, "found:collector_data");
  assert.equal(pyLoad.state.queueCalls, 1);
  assert.equal(pyLoad.state.collectorCalls, 1);
});

test("D3: active-download conservative match confirmed via get_package_data", async () => {
  const pyLoad = makePyLoad(async () => transportThrow(), {
    queueFails: true,
    collectorFails: true,
  });
  function transportThrow() {
    throw transportError("ETIMEDOUT");
  }
  // Queue and collector are unreachable, but an active download exists with
  // the package label we sent; its pid resolves to our exact URL.
  pyLoad.state.downloads = [
    { fid: 1, name: PATH_BASE, package: packageNameOf(URL_A), packageId: 44, state: "downloading" },
  ];
  pyLoad.state.queue = [queuePkg(44, URL_A)]; // detail endpoint returns our URL
  const { registry, log } = fresh();

  const result = await submitDirectLink(URL_A, { pyLoad, registry, log });

  assert.equal(result.status, "accepted");
  assert.equal(result.recovered, true);
  assert.equal(result.packageId, 44);
  assert.equal(result.reconcile, "found:package_data");
  assert.equal(pyLoad.state.detailCalls, 1);
});

test("D4: conservative download-name match without pid → accepted (downloads:name)", async () => {
  const pyLoad = makePyLoad(async () => {
    throw transportError("ECONNRESET");
  });
  pyLoad.state.downloads = [
    { fid: 2, name: PATH_BASE, package: packageNameOf(URL_A), packageId: null, state: "downloading" },
  ];
  const { registry, log } = fresh();

  const result = await submitDirectLink(URL_A, { pyLoad, registry, log });

  assert.equal(result.status, "accepted");
  assert.equal(result.recovered, true);
  assert.equal(result.packageId, null);
  assert.equal(result.reconcile, "found:downloads:name");
});

test("D5: no mutating pyLoad API is ever called during reconciliation", async () => {
  const pyLoad = makePyLoad(async () => {
    throw transportError("ECONNRESET");
  });
  const { registry, log } = fresh();

  await submitDirectLink(URL_A, { pyLoad, registry, log });

  const s = pyLoad.state;
  assert.equal(s.mutateCalls, 0);
  assert.equal(typeof s.addCalls, "number");
  // Only the four READ-ONLY methods were used:
  assert.equal(s.queueCalls, 1);
  assert.equal(s.collectorCalls, 1);
  assert.equal(s.downloadsCalls, 1);
  assert.equal(s.detailCalls, 0); // no candidate pid → no detail call needed
});

test("D6: reconciliation itself failing entirely → ambiguous (undetermined)", async () => {
  const pyLoad = makePyLoad(async () => {
    throw transportError("ETIMEDOUT");
  }, { queueFails: true, collectorFails: true, downloadsFails: true });
  const { registry, log } = fresh();

  const result = await submitDirectLink(URL_A, { pyLoad, registry, log });

  assert.equal(result.status, "ambiguous");
  assert.equal(result.reconcile, "unavailable");
  assert.equal(pyLoad.state.addCalls, 1);
});

// ---------------------------------------------------------------------------
// E — error classification
// ---------------------------------------------------------------------------
test("E: generic 400 + nothing found → ambiguous", async () => {
  const pyLoad = makePyLoad(async () => {
    throw httpError(400, { error: "Bad Request" });
  });
  const { registry, log } = fresh();

  const result = await submitDirectLink(URL_A, { pyLoad, registry, log });

  assert.equal(result.status, "ambiguous");
  assert.equal(pyLoad.state.addCalls, 1);
});

test("E2: generic 422 + nothing found → ambiguous", async () => {
  const pyLoad = makePyLoad(async () => {
    throw httpError(422, { error: "Unprocessable Entity" });
  });
  const { registry, log } = fresh();

  const result = await submitDirectLink(URL_A, { pyLoad, registry, log });

  assert.equal(result.status, "ambiguous");
});

test("E3: explicit validation 400 + nothing found → rejected", async () => {
  const pyLoad = makePyLoad(async () => {
    throw httpError(400, { error: "No valid links supplied" });
  });
  const { registry, log } = fresh();

  const result = await submitDirectLink(URL_A, { pyLoad, registry, log });

  assert.equal(result.status, "rejected");
  assert.ok(result.message.startsWith("pyLoad rejected the link:"));
  assert.equal(pyLoad.state.addCalls, 1);
});

test("E4: explicit validation 422 + nothing found → rejected", async () => {
  const pyLoad = makePyLoad(async () => {
    throw httpError(422, { error: "Invalid URL: cannot parse link" });
  });
  const { registry, log } = fresh();

  const result = await submitDirectLink(URL_A, { pyLoad, registry, log });

  assert.equal(result.status, "rejected");
});

test("E5: 400 + matching queue package → accepted/recovered", async () => {
  const pyLoad = makePyLoad(async ({ state, url }) => {
    state.queue.push(queuePkg(9, url));
    throw httpError(400, { error: "Bad Request" });
  });
  const { registry, log } = fresh();

  const result = await submitDirectLink(URL_A, { pyLoad, registry, log });

  assert.equal(result.status, "accepted");
  assert.equal(result.recovered, true);
  assert.equal(result.packageId, 9);
});

test("E6: 502 + matching collector package → accepted/recovered", async () => {
  const pyLoad = makePyLoad(async ({ state, url }) => {
    state.collector.push(queuePkg(12, url));
    throw httpError(502, "<html>Bad Gateway</html>");
  });
  const { registry, log } = fresh();

  const result = await submitDirectLink(URL_A, { pyLoad, registry, log });

  assert.equal(result.status, "accepted");
  assert.equal(result.recovered, true);
  assert.equal(result.packageId, 12);
  assert.equal(result.reconcile, "found:collector_data");
});

test("E7: timeout + matching collector package → accepted/recovered", async () => {
  const pyLoad = makePyLoad(async ({ state, url }) => {
    state.collector.push(queuePkg(15, url));
    throw transportError("ETIMEDOUT");
  });
  const { registry, log } = fresh();

  const result = await submitDirectLink(URL_A, { pyLoad, registry, log });

  assert.equal(result.status, "accepted");
  assert.equal(result.recovered, true);
});

test("E8: 401 after withAuth retry → rejected + session reset", async () => {
  const pyLoad = makePyLoad(async () => {
    throw httpError(401, { error: "Unauthorized" });
  });
  const { registry, log } = fresh();

  const result = await submitDirectLink(URL_A, { pyLoad, registry, log });

  assert.equal(result.status, "rejected");
  assert.ok(result.message.includes("credentials"));
  assert.equal(pyLoad.state.reset, 1);
});

// ---------------------------------------------------------------------------
// F — idempotency
// ---------------------------------------------------------------------------
test("F: concurrent duplicate URL → one add_package call", async () => {
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  const pyLoad = makePyLoad(async ({ state, url }) => {
    await gate;
    return { packageId: 3, packageName: url };
  });
  const { registry, log } = fresh();

  const first = submitDirectLink(URL_A, { pyLoad, registry, log });
  const second = submitDirectLink(URL_A, { pyLoad, registry, log });
  release();

  const [r1, r2] = await Promise.all([first, second]);

  assert.equal(pyLoad.state.addCalls, 1, "add_package must run exactly once");
  assert.equal(r1.status, "accepted");
  assert.equal(r2.status, "accepted");
  assert.equal(r2.duplicate, true);
});

test("F2: repeated accepted URL within TTL → no duplicate add", async () => {
  const pyLoad = makePyLoad(async () => ({ packageId: 1, packageName: URL_A }));
  const { registry, log } = fresh();

  await submitDirectLink(URL_A, { pyLoad, registry, log });
  const again = await submitDirectLink(URL_A, { pyLoad, registry, log });

  assert.equal(pyLoad.state.addCalls, 1);
  assert.equal(again.duplicate, true);
  assert.equal(again.status, "accepted");
});

test("F3: repeated ambiguous URL → reconciliation only, never add_package", async () => {
  const pyLoad = makePyLoad(async () => {
    throw transportError("ECONNABORTED");
  });
  const { registry, log } = fresh();

  const first = await submitDirectLink(URL_A, { pyLoad, registry, log });
  assert.equal(first.status, "ambiguous");
  assert.equal(pyLoad.state.addCalls, 1);

  const second = await submitDirectLink(URL_A, { pyLoad, registry, log });
  assert.equal(second.status, "ambiguous");
  assert.equal(pyLoad.state.addCalls, 1, "still exactly one add attempt");
  assert.equal(pyLoad.state.queueCalls, 2, "re-check reconciled again");

  // Later the package shows up → re-check upgrades to accepted/recovered.
  pyLoad.state.queue.push(queuePkg(8, URL_A));
  const third = await submitDirectLink(URL_A, { pyLoad, registry, log });
  assert.equal(third.status, "accepted");
  assert.equal(third.recovered, true);
  assert.equal(pyLoad.state.addCalls, 1);
});

test("F4: rejected URL can be retried after the debounce TTL", async () => {
  const pyLoad = makePyLoad(async () => {
    throw httpError(400, { error: "No valid links supplied" });
  });
  let clock = 1_000_000;
  const registry = createSubmissionRegistry({
    ttls: { accepted: 60_000, ambiguous: 60_000, rejected: 1_000 },
    now: () => clock,
  });
  const log = makeLog();

  const first = await submitDirectLink(URL_A, { pyLoad, registry, log });
  assert.equal(first.status, "rejected");

  const immediate = await submitDirectLink(URL_A, { pyLoad, registry, log });
  assert.equal(immediate.duplicate, true, "debounced inside the TTL");
  assert.equal(pyLoad.state.addCalls, 1);

  clock += 2_000; // past the 1s rejected debounce
  const retried = await submitDirectLink(URL_A, { pyLoad, registry, log });
  assert.equal(pyLoad.state.addCalls, 2, "retry allowed after debounce");
  assert.equal(retried.status, "rejected");
});

// ---------------------------------------------------------------------------
// G — privacy
// ---------------------------------------------------------------------------
test("G: full signed URL absent from server logs", async () => {
  const pyLoad = makePyLoad(async ({ state, url }) => {
    state.queue.push(queuePkg(1, url));
    return { packageId: 1, packageName: url };
  });
  const { registry, log } = fresh();

  await submitDirectLink(URL_A, { pyLoad, registry, log });

  const all = log.lines.join("\n");
  assert.ok(!all.includes(URL_A), "signed URL must never be logged");
  assert.ok(!all.includes("X-Amz-Signature"), "signature param must never be logged");
  assert.ok(all.includes("fp="), "fingerprint is the log correlation id");
});

test("G2: explicit validation 400 with secrets in body → rejected, secrets sanitized", async () => {
  const pyLoad = makePyLoad(async () => {
    throw httpError(400, {
      error:
        "Invalid link: https://cdn.example.com/f.mkv?token=SIGNEDSECRET999&sig=aabbcc csrf_token=CSRFTOPSECRET",
    });
  });
  const { registry, log } = fresh();

  const result = await submitDirectLink(URL_A, { pyLoad, registry, log });

  // "Invalid link: …" is explicit pyLoad validation phrasing and
  // reconciliation finds nothing → definite rejection, but the signed query
  // material inside the reason is redacted.
  assert.equal(result.status, "rejected");
  const everything = `${result.message}\n${result.reason}\n${log.lines.join("\n")}`;
  assert.ok(!everything.includes("SIGNEDSECRET999"));
  assert.ok(!everything.includes("CSRFTOPSECRET"));
  assert.ok(!everything.includes(URL_A));
});

test("G2b: token-like values in a GENERIC 400 → ambiguous, secrets sanitized", async () => {
  const pyLoad = makePyLoad(async () => {
    throw httpError(400, {
      error: `Request failed: jwt=eyJhbGciOiJIUzI1NiJ9.aaaaaaaaaaaa.bbbbbbbbbbbb`,
    });
  });
  const { registry, log } = fresh();

  const result = await submitDirectLink(URL_A, { pyLoad, registry, log });

  assert.equal(result.status, "ambiguous");
  const everything = `${result.message}\n${result.reason}\n${log.lines.join("\n")}`;
  assert.ok(!everything.includes("eyJhbGciOiJIUzI1NiJ9"), "JWT must be redacted");
});

test("G3: raw URL-like packageName never exposed; safeDisplayName derivation", async () => {
  // Priority: Content-Disposition > resolved name > path basename > neutral.
  assert.equal(
    safeDisplayName({ contentDisposition: 'attachment; filename="Film.mkv"', url: URL_A }),
    "Film.mkv"
  );
  assert.equal(
    safeDisplayName({ contentDisposition: "attachment; filename*=UTF-8''Na%C3%AFve.mkv", url: URL_A }),
    "Naïve.mkv"
  );
  assert.equal(safeDisplayName({ resolvedName: PATH_BASE, url: URL_A }), PATH_BASE);
  assert.equal(safeDisplayName({ url: URL_A }), PATH_BASE);
  assert.equal(safeDisplayName({ url: "https://e.com/" }), "Direct download");
  assert.equal(safeDisplayName({}), "Direct download");

  // URL-ish "resolved names" are rejected as leak vectors.
  assert.equal(
    safeDisplayName({ resolvedName: `${URL_A}?X-Amz-Signature=x`, url: URL_A }),
    PATH_BASE
  );
});

test("G4: displayUrl strips query/fragment; fingerprint correlation intact", async () => {
  const { sanitizeUrlForDisplay } = require("../services/submissionIdentity");
  assert.equal(
    sanitizeUrlForDisplay(URL_A),
    "https://acct.r2.cloudflarestorage.com/bucket/Movie.2024.1080p.mkv"
  );
  assert.ok(!sanitizeUrlForDisplay(URL_A).includes("?"));
});

// ---------------------------------------------------------------------------
// Preflight integration (unit level, stubbed)
// ---------------------------------------------------------------------------
test("preflight rejected → REJECTED without any pyLoad call", async () => {
  const pyLoad = makePyLoad(async () => ({ packageId: 1, packageName: URL_A }));
  const { registry, log } = fresh();

  const result = await submitDirectLink(URL_A, {
    pyLoad,
    registry,
    log,
    preflightFn: async () => ({
      verdict: "rejected",
      reason: "Source rejected the link: HTTP 403 Forbidden",
    }),
  });

  assert.equal(result.status, "rejected");
  assert.ok(result.message.includes("HTTP 403 Forbidden"));
  assert.equal(pyLoad.state.addCalls, 0, "pyLoad never contacted");
});

test("preflight accepted (206) → submission proceeds, filename becomes displayName", async () => {
  const pyLoad = makePyLoad(async () => ({ packageId: 2, packageName: URL_A }));
  const { registry, log } = fresh();

  const result = await submitDirectLink(URL_A, {
    pyLoad,
    registry,
    log,
    preflightFn: async () => ({
      verdict: "accepted",
      filename: "Preflight.Name.mkv",
      reason: "Range GET succeeded",
    }),
  });

  assert.equal(result.status, "accepted");
  assert.equal(pyLoad.state.addCalls, 1);
  assert.equal(result.displayName, "Preflight.Name.mkv");
});

// ---------------------------------------------------------------------------
// urlsMatch semantics
// ---------------------------------------------------------------------------
test("urlsMatch: exact match, normalization equality, signed-param sensitivity", () => {
  assert.ok(urlsMatch(URL_A, URL_A));
  // URL parsing equalizes scheme/host case.
  assert.ok(urlsMatch("HTTPS://E.COM/a.mkv", "https://e.com/a.mkv"));
  // Bare origin gains the default "/".
  assert.ok(urlsMatch("https://e.com", "https://e.com/"));
  // Distinct paths stay distinct (a directory redirect is NOT the same link).
  assert.ok(!urlsMatch("https://e.com/a.mkv", "https://e.com/a.mkv/"));
  assert.ok(!urlsMatch(URL_A, URL_A.replace("aa11", "bb22")));
  assert.ok(!urlsMatch(URL_A, URL_B));
  assert.ok(!urlsMatch(null, URL_A));
});

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
function packageNameOf(url) {
  return url.length > 200 ? url.slice(0, 200) : url;
}
