const axios = require("axios");

/**
 * pyLoad integration — REX talks to pyLoad only from the server. Credentials
 * come from backend/.env or backend/.auth-secrets.json (PYLOAD_URL,
 * PYLOAD_USERNAME, PYLOAD_PASSWORD) and never reach the browser.
 *
 * The pyLoad instance this targets (0.5.x, pyLoad-ng API) removed the old
 * /api/login session API — legacy calls now get "Obsolete API". The current
 * surface is:
 *   - web-UI login: POST /login (CSRF-protected) -> pyload_session_* cookie
 *   - JSON API under /api/* authenticated by that session cookie
 *   - state-changing calls additionally require the X-CSRFToken header
 * REX therefore logs in once through the web UI, caches the session cookie
 * and CSRF token, and calls the /api/* endpoints directly. On a 401/403 the
 * session is dropped and re-established before one retry.
 *
 * REX deliberately does NOT set a filename, folder or category — pyLoad
 * resolves the real download name itself, and the existing pyLoad →
 * Radarr/Sonarr importer continues to handle everything downstream.
 */

const LOGIN_TIMEOUT = 10000;
const API_TIMEOUT = 15000;

let cachedAuth = null; // { cookieName, cookieValue, csrfToken }

/**
 * Single-flight login: when several requests race on a cold session (e.g. the
 * Direct Link page firing /api/pyload + /api/pyload/status concurrently), they
 * all await the SAME login promise instead of each calling pyLoad's /login —
 * one login invalidating another was the confirmed cause of the false
 * "pyLoad is unreachable" state. Cleared on failure so the next request can
 * retry normally.
 */
let loginInFlight = null;

function getConfig() {
  return {
    baseUrl: (process.env.PYLOAD_URL || "").trim().replace(/\/+$/, ""),
    username: process.env.PYLOAD_USERNAME || "admin",
    password: process.env.PYLOAD_PASSWORD || "za2yrocks",
  };
}

function isConfigured() {
  const { baseUrl, username, password } = getConfig();
  return Boolean(baseUrl && username && password);
}

function getBaseUrl() {
  return getConfig().baseUrl || null;
}

/** Extract the first Set-Cookie name=value pair from axios headers. */
function extractCookie(setCookie) {
  const headers = Array.isArray(setCookie)
    ? setCookie
    : setCookie
    ? [setCookie]
    : [];
  for (const header of headers) {
    const pair = String(header).split(";")[0];
    const eq = pair.indexOf("=");
    if (eq > 0) {
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      if (name && value) return { name, value };
    }
  }
  return null;
}

/** Pull the CSRF token out of a pyLoad HTML page. */
function readCsrfToken(html) {
  const match = String(html).match(/name="csrf-token"\s+content="([^"]+)"/);
  return match ? match[1] : null;
}

/** The login page is recognizable by its login form / username field. */
function isLoginPage(html) {
  return /id="login"|name="username"/.test(String(html));
}

/** Credential-free error carrying an HTTP-ish status for the controller. */
function authError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

/**
 * Log in to pyLoad's web UI and cache the session cookie + CSRF token.
 * This is the auth path for pyLoad 0.5.x+ ("Obsolete API" on /api/login).
 */
async function login() {
  const { baseUrl, username, password } = getConfig();

  // 1) GET /login seeds a session cookie and a CSRF token for that session.
  let seed;
  try {
    seed = await axios.get(`${baseUrl}/login`, { timeout: LOGIN_TIMEOUT });
  } catch (error) {
    if (error.response && error.response.status === 404) {
      throw authError(
        "pyLoad web login is not reachable (check PYLOAD_URL).",
        404
      );
    }
    throw error;
  }

  const cookie = extractCookie(seed.headers["set-cookie"]);
  const csrf = readCsrfToken(seed.data);
  if (!csrf) {
    throw authError(
      "pyLoad login page did not include a CSRF token (check PYLOAD_URL).",
      502
    );
  }

  const seedCookieHeader = cookie ? `${cookie.name}=${cookie.value}` : "";

  // 2) POST credentials — the redirect response carries the real session
  //    cookie, so do not follow it (maxRedirects 0, accept <400).
  const loginRes = await axios.post(
    `${baseUrl}/login`,
    new URLSearchParams({
      do: "login",
      csrf_token: csrf,
      username,
      password,
    }).toString(),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        ...(seedCookieHeader ? { Cookie: seedCookieHeader } : {}),
      },
      maxRedirects: 0,
      validateStatus: (status) => status < 400,
      timeout: LOGIN_TIMEOUT,
    }
  );

  const session = extractCookie(loginRes.headers["set-cookie"]) || cookie;
  if (!session) {
    throw authError("pyLoad login did not return a session cookie.", 502);
  }

  // 3) The token above belongs to the pre-login session — fetch an
  //    authenticated page to get the CSRF token for the new session.
  const authed = await axios.get(`${baseUrl}/dashboard`, {
    headers: { Cookie: `${session.name}=${session.value}` },
    timeout: LOGIN_TIMEOUT,
  });
  if (isLoginPage(authed.data)) {
    throw authError("pyLoad rejected the credentials.", 401);
  }
  const authedCsrf = readCsrfToken(authed.data);
  if (!authedCsrf) {
    throw authError("pyLoad did not return a CSRF token after login.", 502);
  }

  cachedAuth = {
    cookieName: session.name,
    cookieValue: session.value,
    csrfToken: authedCsrf,
  };
  return cachedAuth;
}

async function getSession() {
  if (cachedAuth) return cachedAuth;
  if (!loginInFlight) {
    loginInFlight = login()
      .then((auth) => {
        cachedAuth = auth;
        return auth;
      })
      .finally(() => {
        loginInFlight = null; // success: cached; failure: clear for retry
      });
  }
  return loginInFlight;
}

/** Force a fresh session next call (used after an auth failure). */
function resetSession() {
  cachedAuth = null;
}

function authHeaders(auth) {
  return {
    Cookie: `${auth.cookieName}=${auth.cookieValue}`,
    "X-CSRFToken": auth.csrfToken,
  };
}

/**
 * Run fn(auth) once; on an auth failure (401/403) drop the cached session,
 * re-login and retry once so a stale/expired session self-heals.
 */
async function withAuth(fn) {
  let auth = await getSession();
  try {
    return await fn(auth);
  } catch (error) {
    const status = error.response ? error.response.status : error.status || null;
    if (status === 401 || status === 403) {
      resetSession();
      // Re-login through getSession so concurrent retries also share ONE
      // in-flight login instead of stampeding pyLoad's /login.
      auth = await getSession();
      return fn(auth);
    }
    throw error;
  }
}

/**
 * Add one direct download link to pyLoad's queue. pyLoad decides the actual
 * download filename — REX only supplies a neutral package label (the URL
 * itself, truncated) so the status page can match it back later.
 */
async function addPackage(url) {
  return withAuth(async (auth) => {
    const { baseUrl } = getConfig();
    const packageName = url.length > 200 ? url.slice(0, 200) : url;

    // dest defaults to the queue (Destination.QUEUE = 1) server-side.
    const { data } = await axios.post(
      `${baseUrl}/api/add_package`,
      { name: packageName, links: [url] },
      {
        headers: { ...authHeaders(auth), "Content-Type": "application/json" },
        timeout: API_TIMEOUT,
      }
    );

    return { packageId: extractPackageId(data), packageName };
  });
}

function extractPackageId(data) {
  if (data == null) return null;
  if (typeof data === "number") return data;
  if (typeof data === "string") {
    const parsed = Number.parseInt(data, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (typeof data === "object") {
    const value = data.pid ?? data.package ?? data.packageId ?? data.id;
    if (value == null) return null;
    const parsed = Number.parseInt(String(value), 10);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

/**
 * Delete packages by id (removes them from pyLoad's queue/collector).
 * Used for cleaning up test/duplicate downloads — never touches files on
 * disk (delete_files defaults to false server-side).
 */
async function deletePackages(packageIds) {
  return withAuth(async (auth) => {
    const { baseUrl } = getConfig();
    const pids = (Array.isArray(packageIds) ? packageIds : [packageIds])
      .map((id) => Number.parseInt(String(id), 10))
      .filter((id) => Number.isInteger(id) && id > 0);
    if (pids.length === 0) throw new Error("No valid package ids to delete.");

    const { data } = await axios.post(
      `${baseUrl}/api/delete_packages`,
      { package_ids: pids },
      {
        headers: { ...authHeaders(auth), "Content-Type": "application/json" },
        timeout: API_TIMEOUT,
      }
    );

    return data;
  });
}

/** Map a pyLoad statusmsg string to a compact state for the UI. */
function categorizeStatus(statusMsg, status) {
  const msg = String(statusMsg || "").toLowerCase();

  if (/finish/.test(msg)) return "finished";
  if (/fail|error|offline|not available|invalid|unresolv|skip/.test(msg)) {
    return "failed";
  }
  if (/paus/.test(msg)) return "paused";
  if (/wait/.test(msg)) return "waiting";
  if (/queue/.test(msg)) return "queued";
  if (/process|extract|decrypt|resolv|analy/.test(msg)) return "processing";
  if (/download|fetch|connect|start/.test(msg)) return "downloading";

  // Fallback to the numeric status code (pyLoad 0.5.x DownloadStatus enum)
  // when the message is generic:
  //   0 FINISHED · 12 DOWNLOADING · 7 STARTING · 3 QUEUED · 2 ONLINE ·
  //   5 WAITING · 13 PROCESSING · 10 DECRYPTING · 8 FAILED · 9 ABORTED ·
  //   4 SKIPPED · 1 OFFLINE · 6 TEMPOFFLINE · 11 CUSTOM · 14 UNKNOWN
  if (typeof status === "number") {
    if (status === 0) return "finished";
    if (status === 12 || status === 7) return "downloading";
    if (status === 3 || status === 2) return "queued";
    if (status === 5) return "waiting";
    if (status === 13 || status === 10) return "processing";
    if (status === 8 || status === 9 || status === 4 || status === 1 || status === 6) {
      return "failed";
    }
  }

  return "active";
}

function toNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function mapDownload(item) {
  const progress =
    toNumber(item.progress) ??
    toNumber(item.percent) ??
    toNumber(
      typeof item.format_status === "string"
        ? item.format_status.match(/[\d.]+/)?.[0]
        : item.format_status
    );

  const state = categorizeStatus(item.statusmsg, item.status);

  return {
    fid: item.fid ?? null,
    name: item.name || "Unknown file",
    package: item.package_name || item.package || "",
    packageId: toNumber(item.package_id) ?? toNumber(item.packageid) ?? null,
    state,
    status: item.statusmsg || item.status || "active",
    progress: progress != null ? Math.max(0, Math.min(100, progress)) : null,
    size: toNumber(item.size),
    speed: toNumber(item.speed),
    eta: toNumber(item.eta),
  };
}

/** Current downloads (name, status, progress, size, speed, ETA). */
async function getDownloads() {
  return withAuth(async (auth) => {
    const { baseUrl } = getConfig();
    const { data } = await axios.get(`${baseUrl}/api/status_downloads`, {
      headers: authHeaders(auth),
      timeout: API_TIMEOUT,
    });

    const list = Array.isArray(data) ? data : data && data.downloads;
    return Array.isArray(list) ? list.map(mapDownload) : [];
  });
}

/**
 * Queue summary — packages sitting in pyLoad's queue (waiting or active).
 * Read-only; used by the Pipeline page to show queued downloads. Returns
 * { packageCount, linkCount, packages }.
 */
async function getQueue() {
  return withAuth(async (auth) => {
    const { baseUrl } = getConfig();
    const { data } = await axios.get(`${baseUrl}/api/get_queue`, {
      headers: authHeaders(auth),
      timeout: API_TIMEOUT,
    });
    const list = Array.isArray(data) ? data : data && data.packages ? data.packages : [];
    return {
      packageCount: list.length,
      linkCount: list.reduce((sum, pkg) => {
        const n =
          typeof pkg.links === "number"
            ? pkg.links
            : Array.isArray(pkg.links)
            ? pkg.links.length
            : 0;
        return sum + n;
      }, 0),
      packages: list.map((pkg) => ({
        id: pkg.pid ?? null,
        name: pkg.name || "Unknown package",
      })),
    };
  });
}

/**
 * Read-only reconciliation sources (Fix #1), using the pyLoad 0.5.x data
 * endpoints verified on the live NAS. Both return
 *   [{ id, name, links: [{ url, name }] }]
 * so the orchestrator can match the ORIGINAL submitted URL — the only exact
 * identity — inside packages[].links[].url.
 */
function mapPackageData(list) {
  return (Array.isArray(list) ? list : []).map((pkg) => ({
    id: pkg.pid ?? null,
    name: pkg.name || "",
    links: Array.isArray(pkg.links)
      ? pkg.links.map((l) => ({
          url: typeof l === "string" ? l : l && l.url,
          name: typeof l === "object" && l ? l.name : undefined,
        }))
      : [],
  }));
}

/** GET /api/get_queue_data — packages currently in the queue. */
async function getQueueData() {
  return withAuth(async (auth) => {
    const { baseUrl } = getConfig();
    const { data } = await axios.get(`${baseUrl}/api/get_queue_data`, {
      headers: authHeaders(auth),
      timeout: API_TIMEOUT,
    });
    return mapPackageData(Array.isArray(data) ? data : data && data.packages);
  });
}

/** GET /api/get_collector_data — packages parked in the collector. */
async function getCollectorData() {
  return withAuth(async (auth) => {
    const { baseUrl } = getConfig();
    const { data } = await axios.get(`${baseUrl}/api/get_collector_data`, {
      headers: authHeaders(auth),
      timeout: API_TIMEOUT,
    });
    return mapPackageData(Array.isArray(data) ? data : data && data.packages);
  });
}

/**
 * Read-only package detail — original source URLs (Fix #1 reconciliation
 * step 4). Returns { id, name, links: [{ url, name }] } or null.
 */
async function getPackageData(pid) {
  return withAuth(async (auth) => {
    const { baseUrl } = getConfig();
    const { data } = await axios.get(`${baseUrl}/api/get_package_data`, {
      params: { pid },
      headers: authHeaders(auth),
      timeout: API_TIMEOUT,
    });
    if (!data || typeof data !== "object") return null;
    return {
      id: data.pid ?? pid,
      name: data.name || "",
      links: Array.isArray(data.links)
        ? data.links.map((l) => ({
            url: typeof l === "string" ? l : l && l.url,
            name: typeof l === "object" && l ? l.name : undefined,
          }))
        : [],
    };
  });
}

/**
 * Read-only file detail — original source URL for one file (reconciliation
 * step 4). Returns { fid, url, name } or null.
 */
async function getFileData(fid) {
  return withAuth(async (auth) => {
    const { baseUrl } = getConfig();
    const { data } = await axios.get(`${baseUrl}/api/get_file_data`, {
      params: { fid },
      headers: authHeaders(auth),
      timeout: API_TIMEOUT,
    });
    if (!data || typeof data !== "object") return null;
    return { fid: data.fid ?? fid, url: data.url, name: data.name };
  });
}

/** Lightweight reachability + version probe (used by the page and Settings). */
async function probe() {
  if (!isConfigured()) throw new Error("not configured");

  const { baseUrl } = getConfig();

  // status_downloads is cheap and exercises both auth and the API.
  await getDownloads();

  let version = "reachable";
  try {
    const { data } = await withAuth((auth) =>
      axios.get(`${baseUrl}/api/get_server_version`, {
        headers: authHeaders(auth),
        timeout: API_TIMEOUT,
      })
    );
    if (typeof data === "string" && data.trim()) version = data.trim();
  } catch {
    /* version is optional — reachability already proven */
  }

  return version;
}

module.exports = {
  isConfigured,
  getBaseUrl,
  login,
  getSession,
  resetSession,
  addPackage,
  deletePackages,
  getDownloads,
  getQueue,
  getQueueData,
  getCollectorData,
  getPackageData,
  getFileData,
  probe,
};
