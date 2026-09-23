/**
 * Direct Link → pyLoad submission orchestrator (REX OS v2.5.0 Fix #1).
 *
 * Turns "did it work?" into exactly three structured outcomes:
 *
 *   { status: "accepted",  packageId?, recovered?, message: "Added to pyLoad" }
 *   { status: "rejected",  message: "pyLoad rejected the link: <safe reason>" }
 *   { status: "ambiguous", message: "Submission may have been accepted by pyLoad. Checking status…" }
 *
 * Core rules:
 *   - every submission is identified by the URL fingerprint (never by the
 *     first 200 URL characters);
 *   - a repeat of a pending fingerprint awaits the SAME in-flight promise —
 *     add_package is called at most once per fingerprint;
 *   - ANY failure other than a provable pre-flight failure (connection never
 *     reached pyLoad) triggers RECONCILIATION against pyLoad's queue and
 *     active downloads BEFORE a status is chosen — the live Ant-Man case
 *     proved pyLoad can create + start a package even though REX recorded an
 *     HTTP 400/502 error;
 *   - add_package is NEVER re-posted while the result is ambiguous;
 *   - logs and client-facing messages only ever contain the fingerprint and
 *     sanitized text — never the full signed URL, cookies, CSRF tokens or
 *     credentials.
 */

const pyLoadService = require("./pyLoadService");
const {
  submissions: defaultRegistry,
} = require("./submissionRegistry");
const {
  fingerprintUrl,
  packageNameFor,
  sanitizeText,
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

/** HTTP statuses where pyLoad explicitly refused before creating a package. */
const VALIDATION_STATUSES = new Set([400, 422]);

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
 * Does this pyLoad package belong to our submission?
 * Matches the package label we sent (truncated URL) or, when pyLoad returns
 * link lists, the exact submitted URL inside them.
 */
function matchesPackage(pkg, url, packageName) {
  if (!pkg) return false;
  if (pkg.name && pkg.name === packageName) return true;
  if (Array.isArray(pkg.links)) {
    for (const link of pkg.links) {
      const linkUrl =
        typeof link === "string" ? link : link && (link.url || link.href);
      if (linkUrl && linkUrl === url) return true;
    }
  }
  return false;
}

/**
 * Reconciliation — after an uncertain result, ask pyLoad whether the package
 * actually exists. Checks the queue first (get_queue), then active downloads
 * (status_downloads, which carries package names for started downloads —
 * the Ant-Man package had already started downloading).
 *
 * Returns { found, packageId, source, undetermined }:
 *   undetermined = reconciliation itself failed, so we learned nothing.
 */
async function reconcile(pyLoad, { url, packageName }) {
  let anySuccess = false;
  let anyFailure = false;

  try {
    const packages = await pyLoad.listPackages();
    anySuccess = true;
    const match = packages.find((pkg) => matchesPackage(pkg, url, packageName));
    if (match) {
      return {
        found: true,
        packageId: match.id != null ? match.id : null,
        source: "queue",
        undetermined: false,
      };
    }
  } catch {
    anyFailure = true;
  }

  try {
    const downloads = await pyLoad.getDownloads();
    anySuccess = true;
    const match = downloads.find(
      (item) =>
        (item.package && item.package === packageName) ||
        (item.name && packageName && item.name === packageName)
    );
    if (match) {
      return {
        found: true,
        packageId: match.packageId != null ? match.packageId : null,
        source: "downloads",
        undetermined: false,
      };
    }
  } catch {
    anyFailure = true;
  }

  return {
    found: false,
    packageId: null,
    source: null,
    // Learned nothing only when EVERY reconciliation call failed.
    undetermined: anyFailure && !anySuccess,
  };
}

/**
 * Classify a failed add_package attempt, reconciling first whenever pyLoad
 * might already hold the package (the Ant-Man rule).
 */
async function classifyFailure(pyLoad, { url, packageName, fingerprint, error }) {
  const status = httpStatusOf(error);
  const code = error && error.code ? error.code : null;
  const detail = sanitizeText(errorDetail(error));
  const reconcileBase = { url, packageName };

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
  const rec = await reconcile(pyLoad, reconcileBase);

  if (rec.found) {
    return {
      status: "accepted",
      ok: true,
      fingerprint,
      packageName,
      packageId: rec.packageId,
      recovered: true,
      message: ACCEPTED_MESSAGE,
      reason: detail || (status ? `HTTP ${status}` : "recovered"),
      reconcile: `found:${rec.source}`,
      httpStatus: status,
    };
  }

  // 5) Clear validation refusal AND reconciliation ran cleanly with no
  //    package → definite rejection (nothing was created).
  if (VALIDATION_STATUSES.has(status) && !rec.undetermined) {
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

  // 6) Ambiguous: lost/timeout/5xx with no package found, or reconciliation
  //    itself could not run. NEVER auto-resubmit from here.
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
 * full URL, package label (it is the URL), cookies, CSRF or credentials.
 */
function logSubmission(log, result) {
  const parts = [
    new Date().toISOString(),
    `fp=${result.fingerprint}`,
    `state=${result.status}`,
    `http=${result.httpStatus != null ? result.httpStatus : "-"}`,
    `reconcile=${result.reconcile || "skipped"}`,
    `packageId=${result.packageId != null ? result.packageId : "-"}`,
  ];
  if (result.duplicate) parts.push("duplicate=1");
  if (result.attempts != null) parts.push(`attempts=${result.attempts}`);
  if (result.reason) parts.push(`reason="${sanitizeText(result.reason)}"`);

  const line = `[pyLoad][submission] ${parts.join(" ")}`;
  if (result.status === "accepted") {
    if (log && typeof log.log === "function") log.log(line);
  } else if (log && typeof log.error === "function") {
    log.error(line);
  }
}

/**
 * Submit one direct link with idempotency + three-outcome classification.
 *
 * @param {string} url  the trimmed direct download URL
 * @param {object} [options]
 * @param {object} [options.pyLoad]    pyLoad client (mockable in tests)
 * @param {object} [options.registry]  submission registry (mockable in tests)
 * @param {object} [options.log]       logger (mockable in tests)
 * @returns {Promise<object>} { status: accepted|rejected|ambiguous, … }
 */
async function submitDirectLink(url, options = {}) {
  const pyLoad = options.pyLoad || pyLoadService;
  const registry = options.registry || defaultRegistry;
  const log = options.log || console;

  const trimmed = String(url == null ? "" : url).trim();
  const packageName = packageNameFor(trimmed);
  const fingerprint = fingerprintUrl(trimmed);

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
      const rec = await reconcile(pyLoad, { url: trimmed, packageName });
      if (rec.found) {
        const result = {
          status: "accepted",
          ok: true,
          fingerprint,
          packageName,
          packageId: rec.packageId,
          recovered: true,
          message: ACCEPTED_MESSAGE,
          reason: "found during duplicate re-check",
          reconcile: `found:${rec.source}`,
          httpStatus: null,
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
        message: ACCEPTED_MESSAGE,
        reason: null,
        reconcile: "skipped",
        httpStatus: 200,
      };
    } catch (error) {
      result = await classifyFailure(pyLoad, {
        url: trimmed,
        packageName,
        fingerprint,
        error,
      });
    }

    registry.settle(fingerprint, result);
    result.attempts = entry.attempts;
    logSubmission(log, result);
    return result;
  })();

  return entry.promise;
}

module.exports = {
  submitDirectLink,
  reconcile,
  sanitizeText, // re-exported for tests/consumers
  ACCEPTED_MESSAGE,
  AMBIGUOUS_MESSAGE,
};
