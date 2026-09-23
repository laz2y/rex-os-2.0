/**
 * Direct Link → pyLoad submission orchestrator (REX OS v2.5.0 Fix #1).
 *
 * Pipeline: source preflight → single-flight idempotent add_package →
 * three-outcome classification with read-only reconciliation.
 *
 *   { status: "accepted",  packageId?, recovered?, displayName, message: "Added to pyLoad" }
 *   { status: "rejected",  message: "Source rejected…" | "pyLoad rejected the link: <safe reason>" }
 *   { status: "ambiguous", message: "Submission may have been accepted by pyLoad. Checking status…" }
 *
 * Core rules:
 *   - submissions are identified by URL fingerprint (never by name/URL text);
 *   - a repeat of a pending fingerprint awaits the SAME in-flight promise —
 *     add_package runs at most once per fingerprint;
 *   - preflight REJECTED (definite source refusal, e.g. expired r2.dev token
 *     returning 403 HTML) → REJECTED without ever calling pyLoad;
 *   - ANY post-submission failure that may have reached pyLoad reconciles
 *     FIRST (queue_data → collector_data → status_downloads → detail
 *     confirmation), because pyLoad can create + start the package even when
 *     REX records a 400/502 (live Ant-Man evidence);
 *   - add_package is NEVER re-posted while ambiguous;
 *   - reconciliation is strictly READ-ONLY (no restart/move/remove/move to
 *     collector, no destination changes);
 *   - logs and responses never contain the full signed URL, cookies, CSRF
 *     tokens or credentials; displayName is leak-safe.
 */

const pyLoadService = require("./pyLoadService");
const { preflightSource } = require("./sourcePreflight");
const { submissions: defaultRegistry } = require("./submissionRegistry");
const {
  fingerprintUrl,
  packageNameFor,
  sanitizeText,
  safeDisplayName,
} = require("./submissionIdentity");

const ACCEPTED_MESSAGE = "Added to pyLoad";
const AMBIGUOUS_MESSAGE =
  "Submission may have been accepted by pyLoad. Checking status…";

/** Codes that prove the request NEVER reached pyLoad (safe to call rejected). */
const PREFLIGHT_CODES = new Set([
  "ENOTFOUND",
  "EAI_AGAIN",
  "ECONNREFUSED",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ENETDOWN",
]);

/** HTTP statuses where pyLoad *may* have refused before creating a package. */
const VALIDATION_STATUSES = new Set([400, 422]);

/**
 * Explicit pre-enqueue validation phrases — deliberately NARROW.
 * A 400/422 is only a DEFINITE rejection when pyLoad's own structured
 * response clearly says the links/input were invalid BEFORE enqueueing AND
 * clean reconciliation finds no package. Generic "Bad Request", empty/HTML
 * bodies and axios stock messages stay AMBIGUOUS (Ant-Man rule).
 */
const EXPLICIT_VALIDATION_RE =
  /\b(?:no valid links?|invalid links?|no links\s*(?:supplied|provided|given)?|invalid urls?|malformed\s*(?:url|link)|empty links?)\b/i;

function isDefiniteValidationError(error) {
  const status = httpStatusOf(error);
  if (!VALIDATION_STATUSES.has(status)) return false;

  const data = error && error.response ? error.response.data : null;
  if (!data || typeof data !== "object") return false;

  return EXPLICIT_VALIDATION_RE.test(sanitizeText(errorDetail(error)));
}

/** Extract the HTTP status of a pyLoad/axios error, or null for transport errors. */
function httpStatusOf(error) {
  if (error && error.response && error.response.status) {
    return error.response.status;
  }
  if (error && typeof error.status === "number") return error.status; // authError()
  return null;
}

/** Pull a safe, human-readable reason out of an error's response body. */
function errorDetail(error) {
  const data = error && error.response ? error.response.data : null;
  if (typeof data === "string" && data.trim()) return data;
  if (data && typeof data === "object") {
    for (const key of ["message", "error", "detail", "msg", "reason"]) {
      if (typeof data[key] === "string" && data[key].trim()) return data[key];
    }
    try {
      return JSON.stringify(data);
    } catch {
      /* fall through */
    }
  }
  return error && error.message ? error.message : "";
}

/** Credential-free message for failures that never reached pyLoad. */
function preflightMessage(code, baseUrl) {
  let host = null;
  try {
    host = baseUrl ? new URL(baseUrl).hostname : null;
  } catch {
    /* unparseable PYLOAD_URL */
  }
  const where = host ? ` '${host}'` : "";

  if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
    const looksLikeServiceName =
      host && !host.includes(".") && host !== "localhost";
    return (
      `pyLoad is unreachable: the hostname${where} did not resolve.` +
      (looksLikeServiceName
        ? ` '${host}' is a Docker service name — the pyload container must be attached to the same Docker network as rex-backend (rex-net) for it to resolve.`
        : " Check PYLOAD_URL.")
    );
  }
  if (code === "ECONNREFUSED") {
    return `pyLoad refused the connection${where} — is pyLoad running and is the port correct?`;
  }
  if (code === "EHOSTUNREACH" || code === "ENETUNREACH" || code === "ENETDOWN") {
    return `pyLoad is unreachable${where} (no network route) — check the Docker networks shared with rex-backend.`;
  }
  return "pyLoad is unreachable — check PYLOAD_URL.";
}

/**
 * Semantics-preserving URL comparison: exact string first, then the
 * normalized fingerprint. Signed query parameters remain meaningful (they
 * are part of the fingerprint).
 */
function urlsMatch(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  try {
    return fingerprintUrl(a) === fingerprintUrl(b);
  } catch {
    return false;
  }
}

/**
 * Read-only reconciliation (steps 1–4 of the Fix #1 spec):
 *   1. get_queue_data        — packages[].links[].url exact/normalized match
 *   2. get_collector_data    — same (CRITICAL: accepted downloads park here
 *                              after leaving active status)
 *   3. status_downloads      — package_id when known; package-name /
 *                              resolved-file-name matching only as
 *                              conservative secondary evidence
 *   4. get_package_data      — confirms a candidate pid via its original
 *                              URLs when only weak evidence existed
 *
 * Never mutates pyLoad state. Returns
 *   { found, packageId, source, resolvedName, undetermined }.
 */
async function reconcile(pyLoad, { url, packageName, normalizedUrl }) {
  const attempted = [];
  let anySuccess = false;

  const findInPackages = (packages) => {
    for (const pkg of packages || []) {
      for (const link of pkg.links || []) {
        if (urlsMatch(link.url, url)) {
          return { pkg, link };
        }
      }
    }
    return null;
  };

  // ---- Step 1: queue data -------------------------------------------------
  let queueHit = null;
  try {
    attempted.push("queue_data");
    const packages = await pyLoad.getQueueData();
    anySuccess = true;
    queueHit = findInPackages(packages);
    if (queueHit) {
      return {
        found: true,
        packageId: queueHit.pkg.id != null ? queueHit.pkg.id : null,
        source: "queue_data",
        resolvedName: queueHit.link.name || null,
        undetermined: false,
      };
    }
  } catch {
    /* fall through to collector */
  }

  // ---- Step 2: collector data --------------------------------------------
  let collectorHit = null;
  try {
    attempted.push("collector_data");
    const packages = await pyLoad.getCollectorData();
    anySuccess = true;
    collectorHit = findInPackages(packages);
    if (collectorHit) {
      return {
        found: true,
        packageId: collectorHit.pkg.id != null ? collectorHit.pkg.id : null,
        source: "collector_data",
        resolvedName: collectorHit.link.name || null,
        undetermined: false,
      };
    }
  } catch {
    /* fall through to active downloads */
  }

  // ---- Step 3: active downloads (conservative) ----------------------------
  try {
    attempted.push("status_downloads");
    const downloads = await pyLoad.getDownloads();
    anySuccess = true;
    const hit = (downloads || []).find((item) => {
      // Conservative secondary evidence: the package label we sent, or a
      // resolved file name derived from our URL path. A row's package_id
      // alone proves nothing (ids are pyLoad-internal) — when present it is
      // CONFIRMED via get_package_data below before we accept it.
      if (item.package && item.package === packageName) return true;
      const pathBase = (() => {
        try {
          return decodeURIComponent(
            new URL(normalizedUrl).pathname.split("/").pop() || ""
          );
        } catch {
          return "";
        }
      })();
      return Boolean(pathBase && item.name && item.name === pathBase);
    });
    if (hit && hit.packageId != null) {
      // Confirm the candidate via read-only detail (step 4) — package-name
      // equality alone is not exact URL proof.
      try {
        attempted.push("get_package_data");
        const detail = await pyLoad.getPackageData(hit.packageId);
        anySuccess = true;
        const confirmed = (detail && detail.links || []).some((link) =>
          urlsMatch(link.url, url)
        );
        if (confirmed) {
          return {
            found: true,
            packageId: hit.packageId,
            source: "package_data",
            resolvedName: hit.name || null,
            undetermined: false,
          };
        }
      } catch {
        /* confirmation unavailable — keep searching */
      }
    } else if (hit) {
      // No pid to confirm against, but the conservative evidence matched
      // (package label we sent / resolved file name from our URL path).
      return {
        found: true,
        packageId: null,
        source: "downloads:name",
        resolvedName: hit.name || null,
        undetermined: false,
      };
    }
  } catch {
    /* fall through */
  }

  return {
    found: false,
    packageId: null,
    source: null,
    resolvedName: null,
    undetermined: attempted.length > 0 && !anySuccess,
    attempted,
  };
}

/**
 * Classify a failed add_package attempt, reconciling first whenever pyLoad
 * might already hold the package (the Ant-Man rule).
 */
async function classifyFailure(pyLoad, context) {
  const { url, packageName, normalizedUrl, fingerprint, error } = context;
  const status = httpStatusOf(error);
  const code = error && error.code ? error.code : null;
  const detail = sanitizeText(errorDetail(error));

  // 1) Provably never reached pyLoad → definite non-creation (rejected).
  if (status == null && code && PREFLIGHT_CODES.has(code)) {
    return {
      status: "rejected",
      ok: false,
      fingerprint,
      packageName,
      message: preflightMessage(code, pyLoad.getBaseUrl ? pyLoad.getBaseUrl() : null),
      reason: `connection failed (${code})`,
      reconcile: "skipped",
      httpStatus: null,
    };
  }

  // 2) Auth rejected after withAuth's re-login retry — the call was never
  //    authorized, so no package can have been created.
  if (status === 401 || status === 403) {
    if (typeof pyLoad.resetSession === "function") pyLoad.resetSession();
    return {
      status: "rejected",
      ok: false,
      fingerprint,
      packageName,
      message:
        "pyLoad rejected the credentials (check PYLOAD_USERNAME / PYLOAD_PASSWORD).",
      reason: `HTTP ${status}`,
      reconcile: "skipped",
      httpStatus: status,
    };
  }

  // 3) Route missing — add_package was never executed.
  if (status === 404) {
    return {
      status: "rejected",
      ok: false,
      fingerprint,
      packageName,
      message: "pyLoad API route not found (check PYLOAD_URL).",
      reason: "HTTP 404",
      reconcile: "skipped",
      httpStatus: status,
    };
  }

  // 4) Everything else: RECONCILE FIRST. pyLoad may already hold the package
  //    even though the response was an error / lost / timed out.
  const rec = await reconcile(pyLoad, { url, packageName, normalizedUrl });

  if (rec.found) {
    return {
      status: "accepted",
      ok: true,
      fingerprint,
      packageName,
      packageId: rec.packageId,
      recovered: true,
      displayName: safeDisplayName({
        resolvedName: rec.resolvedName,
        url: normalizedUrl,
      }),
      message: ACCEPTED_MESSAGE,
      reason: detail || (status ? `HTTP ${status}` : "recovered"),
      reconcile: `found:${rec.source}`,
      httpStatus: status,
    };
  }

  // 5) Definite rejection ONLY when BOTH hold:
  //      (a) pyLoad's structured response clearly represents a definite
  //          validation/input rejection before enqueueing, AND
  //      (b) reconciliation ran cleanly and found no created package.
  //    Generic/empty/unclear 400/422 → AMBIGUOUS when nothing is found.
  if (
    VALIDATION_STATUSES.has(status) &&
    isDefiniteValidationError(error) &&
    !rec.undetermined
  ) {
    return {
      status: "rejected",
      ok: false,
      fingerprint,
      packageName,
      message: `pyLoad rejected the link: ${detail || `HTTP ${status}`}`,
      reason: detail || `HTTP ${status}`,
      reconcile: "not-found",
      httpStatus: status,
    };
  }

  // 6) Ambiguous: generic 400/422, lost/timeout/5xx with no package found,
  //    or reconciliation itself could not run. NEVER auto-resubmit.
  return {
    status: "ambiguous",
    ok: false,
    fingerprint,
    packageName,
    message: AMBIGUOUS_MESSAGE,
    reason: detail || (status ? `HTTP ${status}` : code || "unknown"),
    reconcile: rec.undetermined ? "unavailable" : "not-found",
    httpStatus: status,
  };
}

/**
 * One sanitized, single-line diagnostic per state change. Never logs the
 * full URL, cookies, CSRF or credentials; displayName is leak-safe.
 */
function logSubmission(log, result) {
  const parts = [
    new Date().toISOString(),
    `fp=${result.fingerprint}`,
    `state=${result.status}`,
    `preflight=${result.preflight || "skipped"}`,
    `http=${result.httpStatus != null ? result.httpStatus : "-"}`,
    `reconcile=${result.reconcile || "skipped"}`,
    `packageId=${result.packageId != null ? result.packageId : "-"}`,
  ];
  if (result.duplicate) parts.push("duplicate=1");
  if (result.attempts != null) parts.push(`attempts=${result.attempts}`);
  if (result.displayName) parts.push(`displayName="${sanitizeText(result.displayName)}"`);
  if (result.reason) parts.push(`reason="${sanitizeText(result.reason)}"`);

  const line = `[pyLoad][submission] ${parts.join(" ")}`;
  if (result.status === "accepted") {
    if (log && typeof log.log === "function") log.log(line);
  } else if (log && typeof log.error === "function") {
    log.error(line);
  }
}

/**
 * Submit one direct link: preflight → idempotent add_package →
 * classification/reconciliation.
 *
 * @param {string} url  the trimmed direct download URL
 * @param {object} [options]
 * @param {object}   [options.pyLoad]       pyLoad client (mockable in tests)
 * @param {object}   [options.registry]     submission registry (mockable)
 * @param {object}   [options.log]          logger (mockable)
 * @param {function} [options.preflightFn]  preflight implementation (mockable)
 * @param {boolean}  [options.skipPreflight] test escape hatch
 * @returns {Promise<object>} { status: accepted|rejected|ambiguous, … }
 */
async function submitDirectLink(url, options = {}) {
  const pyLoad = options.pyLoad || pyLoadService;
  const registry = options.registry || defaultRegistry;
  const log = options.log || console;
  const doPreflight = options.skipPreflight
    ? null
    : options.preflightFn || preflightOverride || preflightSource;

  const trimmed = String(url == null ? "" : url).trim();
  const packageName = packageNameFor(trimmed);
  const fingerprint = fingerprintUrl(trimmed);
  const normalizedUrl = trimmed; // fingerprintUrl normalizes internally

  const existing = registry.get(fingerprint);

  if (existing) {
    // a) In-flight duplicate (double click / browser retry): await the SAME
    //    promise — add_package runs exactly once.
    if (existing.state === "pending" && existing.promise) {
      const result = await existing.promise;
      return { ...result, duplicate: true };
    }

    // b) Recently accepted: return the stored outcome, no pyLoad call.
    if (existing.state === "accepted") {
      return { ...existing.result, duplicate: true };
    }

    // c) Recently rejected: nothing was created; return the stored refusal
    //    (short TTL) instead of hammering pyLoad with an identical request.
    if (existing.state === "rejected") {
      return { ...existing.result, duplicate: true };
    }

    // d) Ambiguous: re-run reconciliation only — NEVER add_package again.
    if (existing.state === "ambiguous") {
      const rec = await reconcile(pyLoad, {
        url: trimmed,
        packageName,
        normalizedUrl,
      });
      if (rec.found) {
        const result = {
          status: "accepted",
          ok: true,
          fingerprint,
          packageName,
          packageId: rec.packageId,
          recovered: true,
          displayName: safeDisplayName({
            resolvedName: rec.resolvedName,
            url: normalizedUrl,
          }),
          message: ACCEPTED_MESSAGE,
          reason: "found during duplicate re-check",
          reconcile: `found:${rec.source}`,
          httpStatus: null,
          preflight: "skipped",
          duplicate: true,
        };
        registry.settle(fingerprint, result);
        logSubmission(log, result);
        return result;
      }
      const result = {
        ...existing.result,
        duplicate: true,
        reconcile: rec.undetermined ? "unavailable" : "not-found",
      };
      logSubmission(log, result);
      return result;
    }

    // Expired/unknown state — fall through and start a fresh submission.
  }

  const entry = registry.begin(fingerprint, packageName);

  entry.promise = (async () => {
    // ---- Source preflight (before any pyLoad call) ------------------------
    let preflightInfo = null;
    if (doPreflight) {
      try {
        preflightInfo = await doPreflight(trimmed);
      } catch {
        preflightInfo = { verdict: "uncertain", reason: "Preflight could not run" };
      }

      if (preflightInfo && preflightInfo.verdict === "rejected") {
        // Definite source refusal — DO NOT call pyLoad.
        const result = {
          status: "rejected",
          ok: false,
          fingerprint,
          packageName,
          message: sanitizeText(preflightInfo.reason) || "Source rejected the link.",
          reason: sanitizeText(preflightInfo.reason),
          reconcile: "skipped",
          httpStatus: null,
          preflight: "rejected",
        };
        registry.settle(fingerprint, result);
        result.attempts = entry.attempts;
        logSubmission(log, result);
        return result;
      }
    }

    // ---- pyLoad submission ------------------------------------------------
    let result;
    try {
      const added = await pyLoad.addPackage(trimmed);
      result = {
        status: "accepted",
        ok: true,
        fingerprint,
        packageName: added && added.packageName ? added.packageName : packageName,
        packageId: added ? added.packageId ?? null : null,
        recovered: false,
        displayName: safeDisplayName({
          resolvedName: preflightInfo && preflightInfo.filename,
          url: normalizedUrl,
        }),
        message: ACCEPTED_MESSAGE,
        reason: null,
        reconcile: "skipped",
        httpStatus: 200,
        preflight: preflightInfo ? preflightInfo.verdict : "skipped",
      };
    } catch (error) {
      result = await classifyFailure(pyLoad, {
        url: trimmed,
        packageName,
        normalizedUrl,
        fingerprint,
        error,
      });
      result.preflight = preflightInfo ? preflightInfo.verdict : "skipped";
    }

    registry.settle(fingerprint, result);
    result.attempts = entry.attempts;
    logSubmission(log, result);
    return result;
  })();

  return entry.promise;
}

// Test hook: lets controller-level tests stub the preflight without HTTP
// DNS lookups (unit tests pass preflightFn per call instead).
let preflightOverride = null;

module.exports = {
  submitDirectLink,
  reconcile,
  urlsMatch,
  sanitizeText, // re-exported for tests/consumers
  __setPreflight(fn) {
    preflightOverride = fn;
  },
  __resetPreflight() {
    preflightOverride = null;
  },
  ACCEPTED_MESSAGE,
  AMBIGUOUS_MESSAGE,
};
