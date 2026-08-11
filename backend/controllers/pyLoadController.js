const pyLoad = require("../services/pyLoadService");

/**
 * Direct Link Add — REX → pyLoad.
 *
 * The browser only ever talks to these REX endpoints; pyLoad credentials stay
 * server-side. pyLoad resolves the real download filename; REX just feeds the
 * URL into the existing pyLoad queue, which the existing pyLoad →
 * Radarr/Sonarr importer already handles downstream.
 */

/** Friendly, credential-free error for the browser + a log line for the API. */
function fail(res, error, fallback) {
  // error.status is set by pyLoadService for credential-free auth failures
  // (login rejected, wrong URL, missing CSRF), error.response.status for
  // HTTP errors from pyLoad itself.
  const status = error.response ? error.response.status : error.status || null;
  const network = !status && (error.code === "ECONNABORTED" || !error.response);
  const message = network
    ? "pyLoad did not respond in time. Check that pyLoad is running."
    : status === 401
    ? "pyLoad rejected the credentials (check PYLOAD_USERNAME / PYLOAD_PASSWORD)."
    : status === 404
    ? "pyLoad API route not found (check PYLOAD_URL)."
    : status === 400
    ? "pyLoad rejected the link — it may be malformed or unsupported."
    : status
    ? `pyLoad returned HTTP ${status}.`
    : fallback;

  // Server-side detail only — never credentials.
  console.error(
    `[pyLoad] ${fallback} (${status || error.code || "network"}) — ${error.message}`
  );

  res.status(network || status === 401 || status === 404 ? 503 : 502).json({
    ok: false,
    error: message,
  });
}

/** GET /api/pyload — configuration + reachability for the Direct Link page. */
exports.getInfo = async (req, res) => {
  if (!pyLoad.isConfigured()) {
    return res
      .status(503)
      .json({ ok: false, configured: false, error: "pyLoad is not configured" });
  }

  try {
    const version = await pyLoad.probe();
    res.json({
      ok: true,
      configured: true,
      version,
      url: pyLoad.getBaseUrl(),
    });
  } catch (error) {
    fail(res, error, "pyLoad is unreachable.");
  }
};

/** POST /api/pyload/add — { url } → pyLoad.addPackage. */
exports.addLink = async (req, res) => {
  const { url } = req.body || {};
  const trimmed = typeof url === "string" ? url.trim() : "";

  if (!trimmed) {
    return res
      .status(400)
      .json({ ok: false, error: "Enter a download URL first." });
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return res
      .status(400)
      .json({ ok: false, error: "That doesn't look like a valid URL." });
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return res
      .status(400)
      .json({ ok: false, error: "Only http(s) download links are supported." });
  }

  if (!pyLoad.isConfigured()) {
    return res
      .status(503)
      .json({ ok: false, error: "pyLoad is not configured on the server." });
  }

  try {
    const result = await pyLoad.addPackage(trimmed);
    res.json({
      ok: true,
      url: trimmed,
      packageId: result.packageId,
      packageName: result.packageName,
      message: "Download added",
    });
  } catch (error) {
    // A rejected session usually means stale credentials — re-auth next time.
    const authStatus = error.response ? error.response.status : error.status;
    if (authStatus === 401 || authStatus === 403) {
      pyLoad.resetSession();
    }
    fail(res, error, "Failed to add the download in pyLoad.");
  }
};

/** GET /api/pyload/status — active downloads (name, state, progress, …). */
exports.getStatus = async (req, res) => {
  if (!pyLoad.isConfigured()) {
    return res
      .status(503)
      .json({ ok: false, error: "pyLoad is not configured on the server." });
  }

  try {
    const downloads = await pyLoad.getDownloads();
    res.json({ ok: true, downloads });
  } catch (error) {
    const authStatus = error.response ? error.response.status : error.status;
    if (authStatus === 401 || authStatus === 403) {
      pyLoad.resetSession();
    }
    fail(res, error, "Could not fetch pyLoad status.");
  }
};
