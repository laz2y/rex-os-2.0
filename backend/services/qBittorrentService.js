const axios = require("axios");

/**
 * qBittorrent integration — REX talks to qBittorrent only from the server.
 * Credentials come from backend/.env or backend/.auth-secrets.json
 * (QBITTORRENT_URL, QBITTORRENT_USERNAME, QBITTORRENT_PASSWORD) and never
 * reach the browser.
 *
 * Uses the qBittorrent Web API v2:
 *   - POST /api/v2/auth/login  -> "Ok." + SID cookie
 *   - /api/v2/torrents/*       -> torrent list + control (pause/resume/delete/add)
 *   - /api/v2/transfer/info    -> global up/down speeds and totals
 *   - /api/v2/app/version      -> version string
 *
 * The SID cookie is cached after the first login and re-established on a
 * 401/403 before one retry. A Referer header is sent because the WebUI
 * validates request origin on API calls.
 */

const LOGIN_TIMEOUT = 10000;
const API_TIMEOUT = 15000;

let cachedSid = null;

function getConfig() {
  return {
    baseUrl: (process.env.QBITTORRENT_URL || "").trim().replace(/\/+$/, ""),
    username: process.env.QBITTORRENT_USERNAME || "",
    password: process.env.QBITTORRENT_PASSWORD || "",
  };
}

function isConfigured() {
  const { baseUrl, username, password } = getConfig();
  return Boolean(baseUrl && username && password);
}

function getBaseUrl() {
  return getConfig().baseUrl || null;
}

/** Extract the SID session cookie from Set-Cookie headers. */
function extractSid(setCookie) {
  const headers = Array.isArray(setCookie)
    ? setCookie
    : setCookie
    ? [setCookie]
    : [];
  for (const header of headers) {
    for (const part of String(header).split(";")) {
      const eq = part.indexOf("=");
      if (eq > 0 && part.slice(0, eq).trim() === "SID") {
        return part.slice(eq + 1).trim();
      }
    }
  }
  return null;
}

/** Credential-free error carrying an HTTP-ish status for the controller. */
function apiError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function authHeaders(sid) {
  const { baseUrl } = getConfig();
  return {
    Cookie: `SID=${sid}`,
    Referer: baseUrl,
  };
}

/** Log in and cache the SID session cookie. */
async function login() {
  const { baseUrl, username, password } = getConfig();

  let res;
  try {
    res = await axios.post(
      `${baseUrl}/api/v2/auth/login`,
      new URLSearchParams({ username, password }).toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Referer: baseUrl,
        },
        timeout: LOGIN_TIMEOUT,
        validateStatus: (status) => status < 400,
      }
    );
  } catch (error) {
    if (error.response && error.response.status === 404) {
      throw apiError(
        "qBittorrent API is not reachable (check QBITTORRENT_URL).",
        404
      );
    }
    throw error;
  }

  const body = String(res.data || "").trim();
  if (body !== "Ok.") {
    throw apiError(
      body.includes("Fails")
        ? "qBittorrent rejected the credentials."
        : "qBittorrent login failed.",
      body.includes("Fails") ? 401 : 502
    );
  }

  const sid = extractSid(res.headers["set-cookie"]);
  if (!sid) {
    throw apiError("qBittorrent login did not return a session cookie.", 502);
  }

  cachedSid = sid;
  return sid;
}

/** Force a fresh login next call (used after an auth failure). */
function resetSession() {
  cachedSid = null;
}

/**
 * Run fn(sid) once; on an auth failure (401/403) drop the cached session,
 * re-login and retry once so a stale/expired session self-heals.
 */
async function withAuth(fn) {
  let sid = cachedSid || (await login());
  try {
    return await fn(sid);
  } catch (error) {
    const status = error.response ? error.response.status : error.status || null;
    if (status === 401 || status === 403) {
      cachedSid = null;
      sid = await login();
      return fn(sid);
    }
    throw error;
  }
}

function toNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

/** Map a qBittorrent state string to a compact category for the UI. */
function categorizeState(state) {
  switch (state) {
    case "downloading":
    case "forcedDL":
      return "downloading";
    case "uploading":
    case "forcedUP":
      return "seeding";
    case "pausedDL":
    case "pausedUP":
      return "paused";
    case "queuedDL":
    case "queuedUP":
      return "queued";
    case "checkingDL":
    case "checkingUP":
    case "allocating":
    case "moving":
      return "checking";
    case "stalledDL":
    case "stalledUP":
      return "stalled";
    case "metaDL":
      return "metadata";
    case "error":
      return "error";
    case "missingFiles":
      return "missing";
    default:
      return "unknown";
  }
}

function mapTorrent(torrent) {
  return {
    hash: torrent.hash || "",
    name: torrent.name || "Unknown torrent",
    size: toNumber(torrent.size),
    progress:
      torrent.progress != null && Number.isFinite(torrent.progress)
        ? Math.round(torrent.progress * 100)
        : null,
    downloaded: toNumber(torrent.downloaded),
    uploaded: toNumber(torrent.uploaded),
    amountLeft: toNumber(torrent.amount_left),
    downloadSpeed: toNumber(torrent.dlspeed),
    uploadSpeed: toNumber(torrent.upspeed),
    eta: toNumber(torrent.eta),
    ratio: toNumber(torrent.ratio),
    seeds: toNumber(torrent.num_seeds),
    peers: toNumber(torrent.num_leechs),
    state: torrent.state || "unknown",
    status: categorizeState(torrent.state),
    category: torrent.category || "",
    tracker: torrent.tracker || "",
    savePath: torrent.save_path || "",
    addedOn: toNumber(torrent.added_on),
    completionOn: toNumber(torrent.completion_on),
  };
}

/** All torrents (name, state, progress, speeds, ratio, ETA, seeds/peers). */
async function getTorrents() {
  return withAuth(async (sid) => {
    const { baseUrl } = getConfig();
    const { data } = await axios.get(`${baseUrl}/api/v2/torrents/info`, {
      headers: authHeaders(sid),
      timeout: API_TIMEOUT,
    });
    return Array.isArray(data) ? data.map(mapTorrent) : [];
  });
}

/** Global transfer stats (up/down speeds and session totals). */
async function getTransfer() {
  return withAuth(async (sid) => {
    const { baseUrl } = getConfig();
    const { data } = await axios.get(`${baseUrl}/api/v2/transfer/info`, {
      headers: authHeaders(sid),
      timeout: API_TIMEOUT,
    });
    return {
      downloadSpeed: toNumber(data.dl_info_speed),
      uploadSpeed: toNumber(data.up_info_speed),
      downloadData: toNumber(data.dl_info_data),
      uploadData: toNumber(data.up_info_data),
      downloadLimit: toNumber(data.dl_rate_limit),
      uploadLimit: toNumber(data.up_rate_limit),
    };
  });
}

/** qBittorrent version string (e.g. "v4.6.5"). */
async function getVersion() {
  return withAuth(async (sid) => {
    const { baseUrl } = getConfig();
    const { data } = await axios.get(`${baseUrl}/api/v2/app/version`, {
      headers: authHeaders(sid),
      timeout: API_TIMEOUT,
    });
    return String(data || "").trim() || "reachable";
  });
}

/**
 * Add one or more http(s)/magnet links to qBittorrent. The client decides
 * filenames/folders — REX only forwards the link.
 */
async function addTorrent(urls) {
  const list = (Array.isArray(urls) ? urls : [urls])
    .map((url) => String(url).trim())
    .filter(Boolean);
  if (list.length === 0) throw new Error("No download link provided.");

  return withAuth(async (sid) => {
    const { baseUrl } = getConfig();
    const res = await axios.post(
      `${baseUrl}/api/v2/torrents/add`,
      new URLSearchParams({ urls: list.join("\n") }).toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          ...authHeaders(sid),
        },
        timeout: API_TIMEOUT,
      }
    );
    const body = String(res.data || "").trim();
    if (body === "Fails.") {
      throw apiError(
        "qBittorrent could not add the link (invalid or unsupported).",
        400
      );
    }
    return { ok: true, message: body === "Ok." ? "Torrent added" : body };
  });
}

function toHashList(hashes) {
  const list = (Array.isArray(hashes) ? hashes : String(hashes || "").split(","))
    .map((hash) => String(hash).trim())
    .filter(Boolean);
  return list.join(",");
}

async function postControl(endpoint, params) {
  return withAuth(async (sid) => {
    const { baseUrl } = getConfig();
    await axios.post(
      `${baseUrl}/api/v2/torrents/${endpoint}`,
      new URLSearchParams(params).toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          ...authHeaders(sid),
        },
        timeout: API_TIMEOUT,
      }
    );
    return { ok: true };
  });
}

async function pauseTorrents(hashes) {
  return postControl("pause", { hashes: toHashList(hashes) });
}

async function resumeTorrents(hashes) {
  return postControl("resume", { hashes: toHashList(hashes) });
}

/** Remove torrents; deleteFiles=true also removes the downloaded data. */
async function deleteTorrents(hashes, deleteFiles) {
  const params = { hashes: toHashList(hashes) };
  if (deleteFiles) params.deleteFiles = "true";
  return postControl("delete", params);
}

/** Lightweight reachability + version probe (used by the page and Settings). */
async function probe() {
  if (!isConfigured()) throw new Error("not configured");
  return getVersion();
}

module.exports = {
  isConfigured,
  getBaseUrl,
  login,
  resetSession,
  getTorrents,
  getTransfer,
  getVersion,
  addTorrent,
  pauseTorrents,
  resumeTorrents,
  deleteTorrents,
  probe,
};
