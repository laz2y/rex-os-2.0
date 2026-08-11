const axios = require("axios");

/**
 * pyLoad integration — REX talks to pyLoad only from the server. Credentials
 * come from backend/.env or backend/.auth-secrets.json (PYLOAD_URL,
 * PYLOAD_USERNAME, PYLOAD_PASSWORD) and never reach the browser.
 *
 * pyLoad's HTTP/JSON API:
 *   POST /api/login                 -> session token (string, or {session} in pyload-ng)
 *   POST /api/addPackage            -> package id (int)
 *   GET  /api/statusDownloads       -> list of running downloads
 * Sessions are passed back as a `session` query parameter.
 *
 * REX deliberately does NOT set a filename, folder or category — pyLoad
 * resolves the real download name itself, and the existing pyLoad →
 * Radarr/Sonarr importer continues to handle everything downstream.
 */

const LOGIN_TIMEOUT = 10000;
const API_TIMEOUT = 15000;

let cachedSession = null;

function getConfig() {
  return {
    baseUrl: (process.env.PYLOAD_URL || "").trim().replace(/\/+$/, ""),
    username: process.env.PYLOAD_USERNAME || "",
    password: process.env.PYLOAD_PASSWORD || "",
  };
}

function isConfigured() {
  const { baseUrl, username, password } = getConfig();
  return Boolean(baseUrl && username && password);
}

function getBaseUrl() {
  return getConfig().baseUrl || null;
}

/** Log in to pyLoad and cache the session token (never log credentials). */
async function login() {
  const { baseUrl, username, password } = getConfig();

  const { data } = await axios.post(
    `${baseUrl}/api/login`,
    new URLSearchParams({ username, password }).toString(),
    {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      timeout: LOGIN_TIMEOUT,
    }
  );

  // pyload-ng returns { session: "..." }, older pyLoad returns a bare string.
  let session =
    typeof data === "string" ? data.trim() : data && (data.session || data.token);

  if (!session || session === "None") {
    throw new Error("pyLoad login returned no session");
  }

  cachedSession = session;
  return session;
}

async function getSession() {
  if (cachedSession) return cachedSession;
  return login();
}

/** Force a fresh session next call (used after an auth failure). */
function resetSession() {
  cachedSession = null;
}

/**
 * Add one direct download link to pyLoad's queue. pyLoad decides the actual
 * download filename — REX only supplies a neutral package label (the URL
 * itself, truncated) so the status page can match it back later.
 */
async function addPackage(url) {
  const { baseUrl } = getConfig();
  const session = await getSession();
  const packageName = url.length > 200 ? url.slice(0, 200) : url;

  const params = { session };
  const payload = { name: packageName, links: [url] };

  let packageId = null;

  try {
    // pyload-ng style: JSON body.
    const { data } = await axios.post(`${baseUrl}/api/addPackage`, payload, {
      params,
      timeout: API_TIMEOUT,
    });
    packageId = extractPackageId(data);
  } catch (error) {
    // Legacy pyLoad 0.5 style: form-encoded keyword arguments. Only attempt
    // the fallback when the first call produced an HTTP error (not a network
    // failure), so a dead pyLoad never yields a duplicate add.
    if (!error.response) throw error;

    const { data } = await axios.post(
      `${baseUrl}/api/addPackage`,
      new URLSearchParams({
        session,
        name: packageName,
        links: JSON.stringify([url]),
      }).toString(),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        timeout: API_TIMEOUT,
      }
    );
    packageId = extractPackageId(data);
  }

  return { packageId, packageName };
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

/** Map a pyLoad statusmsg string to a compact state for the UI. */
function categorizeStatus(statusMsg, status) {
  const msg = String(statusMsg || "").toLowerCase();

  if (/finish/.test(msg)) return "finished";
  if (/fail|error|offline|not available|invalid|unresolv/.test(msg)) {
    return "failed";
  }
  if (/paus/.test(msg)) return "paused";
  if (/wait/.test(msg)) return "waiting";
  if (/queue/.test(msg)) return "queued";
  if (/process|extract|decrypt|resolv|analy/.test(msg)) return "processing";
  if (/download|fetch|connect/.test(msg)) return "downloading";

  // Fallback to the numeric status code when the message is generic.
  if (typeof status === "number") {
    if (status === 0) return "finished";
    if (status === 3 || status === 15) return "downloading";
    if (status === 2) return "queued";
    if (status === 4 || status === 1 || status === 10) return "failed";
    if (status === 6) return "paused";
    if (status === 9 || status === 14) return "waiting";
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
    package: item.package || "",
    packageId: toNumber(item.packageid) ?? null,
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
  const { baseUrl } = getConfig();
  const session = await getSession();

  const { data } = await axios.get(`${baseUrl}/api/statusDownloads`, {
    params: { session },
    timeout: API_TIMEOUT,
  });

  const list = Array.isArray(data) ? data : data && data.downloads;
  return Array.isArray(list) ? list.map(mapDownload) : [];
}

/** Lightweight reachability + version probe (used by the page and Settings). */
async function probe() {
  if (!isConfigured()) throw new Error("not configured");

  const { baseUrl } = getConfig();

  // statusDownloads is cheap and exercises both auth and the API.
  await getDownloads();

  let version = "reachable";
  try {
    const session = cachedSession || (await login());
    const { data } = await axios.get(`${baseUrl}/api/getServerVersion`, {
      params: { session },
      timeout: API_TIMEOUT,
    });
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
  getDownloads,
  probe,
};
