const pyLoad = require("./pyLoadService");
const qbittorrent = require("./qBittorrentService");
const radarr = require("./radarrService");
const sonarr = require("./sonarrService");
const jellyfin = require("./jellyfinService");

/**
 * Pipeline aggregation — a single GET /api/pipeline payload covering the
 * full media flow: Direct Link → pyLoad → qBittorrent → Radarr/Sonarr →
 * Media → Jellyfin.
 *
 * Every service section is fetched independently and wrapped so one offline
 * or misconfigured service can never fail the whole endpoint. Credentials
 * never leave the server; the browser receives sanitized status + stats
 * only (versions, counts, names, speeds — no keys, no tokens).
 */

function statusOf(error) {
  const http = error.response ? error.response.status : error.status || null;
  if (http === 401 || http === 403) {
    return { status: "auth_failed", detail: "Authentication failed" };
  }
  if (error.code === "ECONNABORTED" || !error.response) {
    return { status: "offline", detail: "Unreachable" };
  }
  return { status: "error", detail: `HTTP ${http}` };
}

function notConfigured() {
  return { status: "not_configured", detail: "Not configured on the server" };
}

/** Compact byte/s formatter for activity details (no raw numbers in the UI). */
function formatSpeed(value) {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size >= 100 || unit === 0 ? Math.round(size) : size.toFixed(1)} ${units[unit]}/s`;
}

/** Map an ARR history record to a compact activity event. */
function toEvent(service, serviceLabel, history) {
  let type;
  switch (history.eventType) {
    case "grabbed":
      type = "grabbed";
      break;
    case "downloadFolderImported":
      type = "imported";
      break;
    case "downloadFailed":
      type = "failed";
      break;
    case "movieFileDeleted":
    case "episodeFileDeleted":
      type = "deleted";
      break;
    default:
      type = "event";
      break;
  }

  return {
    id: `${service}-${history.id}`,
    service,
    serviceLabel,
    time: history.date || null,
    type,
    title: history.title || history.sourceTitle || "Unknown",
    detail: [history.detail, history.quality, history.downloadClient]
      .filter(Boolean)
      .join(" · "),
  };
}

/** pyLoad — active downloads, queued packages, current file. */
async function pyloadSection() {
  if (!pyLoad.isConfigured()) return { ...notConfigured(), label: "pyLoad" };

  try {
    const [version, downloads, queue] = await Promise.all([
      pyLoad.probe(),
      pyLoad.getDownloads(),
      pyLoad.getQueue().catch(() => ({ packageCount: 0, linkCount: 0, packages: [] })),
    ]);

    const current =
      downloads.find((d) => d.state === "downloading") || downloads[0] || null;

    const now = new Date().toISOString();
    const recent = downloads.map((d) => ({
      id: `pyload-dl-${d.fid}`,
      service: "pyload",
      serviceLabel: "pyLoad",
      time: now,
      type: d.state === "failed" ? "failed" : "downloading",
      title: d.name,
      detail: d.progress != null
        ? `${Math.round(d.progress)}%${formatSpeed(d.speed) ? ` · ${formatSpeed(d.speed)}` : ""}`
        : d.status || "",
    }));
    for (const pkg of queue.packages) {
      recent.push({
        id: `pyload-q-${pkg.id}`,
        service: "pyload",
        serviceLabel: "pyLoad",
        time: now,
        type: "queued",
        title: pkg.name,
        detail: "Queued in pyLoad",
      });
    }

    return {
      status: "connected",
      detail: version && version !== "reachable" ? `v${version}` : "Connected",
      version,
      url: pyLoad.getBaseUrl(),
      activeDownloads: downloads.length,
      queuedPackages: queue.packageCount,
      queuedLinks: queue.linkCount,
      current: current
        ? {
            name: current.name,
            progress: current.progress,
            speed: current.speed,
            eta: current.eta,
            size: current.size,
          }
        : null,
      recent,
    };
  } catch (error) {
    console.error(`[pipeline] pyLoad: ${error.message}`);
    return { ...statusOf(error), label: "pyLoad", error: error.message };
  }
}

/** qBittorrent — active/seeding counts, transfer speeds, current torrent. */
async function qbittorrentSection() {
  if (!qbittorrent.isConfigured()) return { ...notConfigured(), label: "qBittorrent" };

  try {
    const [version, transfer, torrents] = await Promise.all([
      qbittorrent.probe(),
      qbittorrent.getTransfer(),
      qbittorrent.getTorrents(),
    ]);

    const fetching = torrents.filter(
      (t) =>
        ["downloading", "metadata", "checking", "queued", "stalled"].includes(t.status) &&
        (t.progress ?? 0) < 99.5
    );
    const seeding = torrents.filter((t) => t.status === "seeding");
    const current =
      torrents.find((t) => t.status === "downloading") ||
      torrents.find((t) => t.status === "metadata") ||
      torrents.find((t) => t.status === "queued" && (t.progress ?? 0) < 99.5) ||
      null;

    const now = new Date().toISOString();
    const recent = [];
    for (const t of fetching.slice(0, 5)) {
      recent.push({
        id: `qb-${t.hash}`,
        service: "qbittorrent",
        serviceLabel: "qBittorrent",
        time: now,
        type: t.status === "stalled" ? "stalled" : "torrenting",
        title: t.name,
        detail: `${Math.round(t.progress ?? 0)}%${
          formatSpeed(t.downloadSpeed) ? ` · ${formatSpeed(t.downloadSpeed)}` : ""
        }`,
      });
    }
    for (const t of seeding.slice(0, 3)) {
      recent.push({
        id: `qb-seed-${t.hash}`,
        service: "qbittorrent",
        serviceLabel: "qBittorrent",
        time: now,
        type: "seeding",
        title: t.name,
        detail: `${Math.round(t.progress ?? 0)}% · ratio ${(t.ratio ?? 0).toFixed(2)}`,
      });
    }

    return {
      status: "connected",
      detail: version && version !== "reachable" ? version : "Connected",
      version,
      activeCount: fetching.length,
      seedingCount: seeding.length,
      totalCount: torrents.length,
      downloadSpeed: transfer.downloadSpeed,
      uploadSpeed: transfer.uploadSpeed,
      current: current
        ? {
            name: current.name,
            progress: current.progress,
            downloadSpeed: current.downloadSpeed,
            uploadSpeed: current.uploadSpeed,
          }
        : null,
      recent,
    };
  } catch (error) {
    console.error(`[pipeline] qBittorrent: ${error.message}`);
    return { ...statusOf(error), label: "qBittorrent", error: error.message };
  }
}

/** Radarr — version, queue, importing, missing, movies, recent history. */
async function radarrSection() {
  if (!radarr.isConfigured()) return { ...notConfigured(), label: "Radarr" };

  try {
    const [status, queue, movies, missing, history] = await Promise.all([
      radarr.getSystemStatus(),
      radarr.getQueue(),
      radarr.getMovies(),
      radarr.getMissing(),
      radarr.getHistory(15),
    ]);

    const importing = queue.records.filter((r) =>
      ["importing", "importPending"].includes(r.trackedDownloadState)
    );
    const failed = queue.records.filter(
      (r) => r.status === "failed" || ["failed", "failedPending"].includes(r.trackedDownloadState)
    );
    const current =
      queue.records.find((r) => ["importing", "importPending", "downloading"].includes(r.trackedDownloadState)) ||
      queue.records[0] ||
      null;

    const recent = history
      .filter((h) =>
        ["grabbed", "downloadFolderImported", "downloadFailed", "movieFileDeleted"].includes(h.eventType)
      )
      .map((h) => toEvent("radarr", "Radarr", h));

    return {
      status: "connected",
      detail: status.version ? `v${status.version}` : "Connected",
      version: status.version,
      queueCount: queue.totalRecords,
      importingCount: importing.length,
      missingCount: missing,
      movieCount: movies.length,
      failedCount: failed.length,
      current: current
        ? { title: current.title, state: current.trackedDownloadState || current.status }
        : null,
      recent,
    };
  } catch (error) {
    console.error(`[pipeline] Radarr: ${error.message}`);
    return { ...statusOf(error), label: "Radarr", error: error.message };
  }
}

/** Sonarr — version, queue, importing, missing, series, recent history. */
async function sonarrSection() {
  if (!sonarr.isConfigured()) return { ...notConfigured(), label: "Sonarr" };

  try {
    const [status, queue, series, missing, history] = await Promise.all([
      sonarr.getSystemStatus(),
      sonarr.getQueue(),
      sonarr.getSeries(),
      sonarr.getMissing(),
      sonarr.getHistory(15),
    ]);

    const importing = queue.records.filter((r) =>
      ["importing", "importPending"].includes(r.trackedDownloadState)
    );
    const failed = queue.records.filter(
      (r) => r.status === "failed" || ["failed", "failedPending"].includes(r.trackedDownloadState)
    );
    const current =
      queue.records.find((r) => ["importing", "importPending", "downloading"].includes(r.trackedDownloadState)) ||
      queue.records[0] ||
      null;

    const recent = history
      .filter((h) =>
        ["grabbed", "downloadFolderImported", "downloadFailed", "episodeFileDeleted"].includes(h.eventType)
      )
      .map((h) => toEvent("sonarr", "Sonarr", h));

    return {
      status: "connected",
      detail: status.version ? `v${status.version}` : "Connected",
      version: status.version,
      queueCount: queue.totalRecords,
      importingCount: importing.length,
      missingCount: missing,
      seriesCount: series.length,
      failedCount: failed.length,
      current: current
        ? { title: current.title, state: current.trackedDownloadState || current.status }
        : null,
      recent,
    };
  } catch (error) {
    console.error(`[pipeline] Sonarr: ${error.message}`);
    return { ...statusOf(error), label: "Sonarr", error: error.message };
  }
}

/** Jellyfin — server info (name + version). */
async function jellyfinSection() {
  if (!process.env.JELLYFIN_URL || !process.env.JELLYFIN_API_KEY) {
    return { ...notConfigured(), label: "Jellyfin" };
  }

  try {
    const info = await jellyfin.getServerInfo();
    return {
      status: "connected",
      detail: info.Version ? `v${info.Version}` : "Connected",
      version: info.Version,
      serverName: info.ServerName || "Jellyfin",
    };
  } catch (error) {
    console.error(`[pipeline] Jellyfin: ${error.message}`);
    return { ...statusOf(error), label: "Jellyfin", error: error.message };
  }
}

/** Merge every section's real events, newest first, capped at 20. */
function mergeActivity(sections) {
  const list = [];
  for (const key of ["pyload", "qbittorrent", "radarr", "sonarr", "jellyfin"]) {
    const section = sections[key];
    if (section && Array.isArray(section.recent)) list.push(...section.recent);
  }
  return list
    .sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0))
    .slice(0, 20);
}

/** GET /api/pipeline — full pipeline payload. Never throws. */
async function getPipeline() {
  const started = Date.now();

  const [pyload, qb, rd, sn, jf] = await Promise.all([
    pyloadSection(),
    qbittorrentSection(),
    radarrSection(),
    sonarrSection(),
    jellyfinSection(),
  ]);

  const services = { pyload, qbittorrent: qb, radarr: rd, sonarr: sn, jellyfin: jf };

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    generatedMs: Date.now() - started,
    services,
    activity: mergeActivity(services),
  };
}

module.exports = {
  getPipeline,
};
