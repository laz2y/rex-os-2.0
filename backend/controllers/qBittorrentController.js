const qbittorrent = require("../services/qBittorrentService");

/**
 * qBittorrent Downloads — REX → qBittorrent Web API v2.
 *
 * The browser only ever talks to these REX endpoints; qBittorrent credentials
 * stay server-side. Torrent filenames/folders are decided by qBittorrent's
 * own configuration — REX only forwards links and surfaces status.
 */

/** Friendly, credential-free error for the browser + a log line for the API. */
function fail(res, error, fallback) {
  // error.status is set by qBittorrentService for credential-free failures,
  // error.response.status for HTTP errors from qBittorrent itself.
  const status = error.response ? error.response.status : error.status || null;
  const network = !status && (error.code === "ECONNABORTED" || !error.response);
  const message = network
    ? "qBittorrent did not respond in time. Check that it is running."
    : status === 401 || status === 403
    ? "qBittorrent rejected the credentials (check QBITTORRENT_USERNAME / QBITTORRENT_PASSWORD)."
    : status === 404
    ? "qBittorrent API route not found (check QBITTORRENT_URL)."
    : status === 400
    ? "qBittorrent rejected the request."
    : status
    ? `qBittorrent returned HTTP ${status}.`
    : fallback;

  // Server-side detail only — never credentials.
  console.error(
    `[qBittorrent] ${fallback} (${status || error.code || "network"}) — ${error.message}`
  );

  res
    .status(network || status === 401 || status === 403 ? 503 : 502)
    .json({ ok: false, error: message });
}

/** GET /api/qbittorrent — version, transfer stats and the full torrent list. */
exports.getOverview = async (req, res) => {
  if (!qbittorrent.isConfigured()) {
    return res
      .status(503)
      .json({ ok: false, configured: false, error: "qBittorrent is not configured" });
  }

  try {
    const [version, transfer, torrents] = await Promise.all([
      qbittorrent.probe(),
      qbittorrent.getTransfer(),
      qbittorrent.getTorrents(),
    ]);

    res.json({
      ok: true,
      configured: true,
      version,
      transfer,
      torrents,
    });
  } catch (error) {
    fail(res, error, "qBittorrent is unreachable.");
  }
};

/** POST /api/qbittorrent/add — { url } → qBittorrent.addTorrent. */
exports.addTorrent = async (req, res) => {
  const { url } = req.body || {};
  const trimmed = typeof url === "string" ? url.trim() : "";

  if (!trimmed) {
    return res.status(400).json({ ok: false, error: "Enter a download link first." });
  }

  if (!/^https?:\/\//i.test(trimmed) && !/^magnet:\?/i.test(trimmed)) {
    return res
      .status(400)
      .json({ ok: false, error: "Use an http(s) link or a magnet link." });
  }

  if (!qbittorrent.isConfigured()) {
    return res
      .status(503)
      .json({ ok: false, error: "qBittorrent is not configured on the server." });
  }

  try {
    const result = await qbittorrent.addTorrent([trimmed]);
    res.json({
      ok: true,
      url: trimmed,
      message: result.message || "Torrent added",
    });
  } catch (error) {
    fail(res, error, "Failed to add the torrent in qBittorrent.");
  }
};

/** Extract a non-empty hash list from req.body (string or array). */
function parseHashes(req) {
  const { hashes } = req.body || {};
  return (Array.isArray(hashes) ? hashes : String(hashes || "").split(","))
    .map((hash) => String(hash).trim())
    .filter(Boolean);
}

function requireHashes(req, res) {
  const hashes = parseHashes(req);
  if (hashes.length === 0) {
    res.status(400).json({ ok: false, error: "No torrent selected." });
    return null;
  }
  return hashes;
}

/** POST /api/qbittorrent/pause — { hashes } */
exports.pauseTorrents = async (req, res) => {
  const hashes = requireHashes(req, res);
  if (!hashes) return;

  try {
    await qbittorrent.pauseTorrents(hashes);
    res.json({ ok: true, paused: hashes.length });
  } catch (error) {
    fail(res, error, "Failed to pause the torrent.");
  }
};

/** POST /api/qbittorrent/resume — { hashes } */
exports.resumeTorrents = async (req, res) => {
  const hashes = requireHashes(req, res);
  if (!hashes) return;

  try {
    await qbittorrent.resumeTorrents(hashes);
    res.json({ ok: true, resumed: hashes.length });
  } catch (error) {
    fail(res, error, "Failed to resume the torrent.");
  }
};

/** POST /api/qbittorrent/remove — { hashes, deleteFiles } */
exports.removeTorrents = async (req, res) => {
  const hashes = requireHashes(req, res);
  if (!hashes) return;

  const deleteFiles = Boolean(req.body && req.body.deleteFiles);

  try {
    await qbittorrent.deleteTorrents(hashes, deleteFiles);
    res.json({ ok: true, removed: hashes.length, deleteFiles });
  } catch (error) {
    fail(res, error, "Failed to remove the torrent.");
  }
};
