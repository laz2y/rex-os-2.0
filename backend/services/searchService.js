const radarr = require("./radarrService");
const sonarr = require("./sonarrService");
const jellyfin = require("./jellyfinService");
const qbittorrent = require("./qBittorrentService");
const portainer = require("./portainerService");
const activity = require("./activityService");

/**
 * REX OS Global Search — one debounced endpoint across every real source.
 *
 * Sources (each isolated — one failure never breaks the others):
 *   - Radarr movies        (server-side, filtered by title)
 *   - Sonarr series        (server-side, filtered by title)
 *   - Jellyfin library     (server-side search)
 *   - qBittorrent torrents (server-side, filtered by name)
 *   - Docker containers    (server-side, filtered by name/image)
 *   - REX activity log     (server-side text search)
 *   - REX OS pages         (static index — navigation shortcuts)
 *
 * Results carry type + name + status + an action so the UI can render a
 * consistent list. Per-query results are cached for 15s so a debounced
 * frontend never hammers the external services on every keystroke.
 */

const CACHE_MS = 15000;
const cache = new Map(); // query -> { at, value }

function cleanQuery(raw) {
  return String(raw || "").trim().slice(0, 120);
}

function hit(query) {
  const entry = cache.get(query);
  if (entry && Date.now() - entry.at < CACHE_MS) return entry.value;
  return null;
}

function put(query, value) {
  cache.set(query, { at: Date.now(), value });
  // Bound the cache so it cannot grow without limit.
  if (cache.size > 50) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* ------------------------------------------------------------------ */
/* Sources                                                             */
/* ------------------------------------------------------------------ */

async function searchRadarr(query) {
  if (!radarr.isConfigured()) return [];
  const movies = await radarr.getMovies();
  const re = new RegExp(escapeRegExp(query), "i");
  return movies
    .filter((movie) => re.test(movie.title || ""))
    .slice(0, 8)
    .map((movie) => ({
      id: `radarr-${movie.id}`,
      type: "movie",
      source: "radarr",
      name: movie.title || "Unknown movie",
      status: movie.hasFile ? "Downloaded" : movie.monitored ? "Missing" : "Unmonitored",
      detail: movie.year ? String(movie.year) : "",
      action: { kind: "navigate", label: "Media", to: "/media" },
    }));
}

async function searchSonarr(query) {
  if (!sonarr.isConfigured()) return [];
  const series = await sonarr.getSeries();
  const re = new RegExp(escapeRegExp(query), "i");
  return series
    .filter((show) => re.test(show.title || ""))
    .slice(0, 8)
    .map((show) => ({
      id: `sonarr-${show.id}`,
      type: "series",
      source: "sonarr",
      name: show.title || "Unknown series",
      status: show.monitored ? "Monitored" : "Unmonitored",
      detail: show.year ? String(show.year) : "",
      action: { kind: "navigate", label: "Media", to: "/media" },
    }));
}

async function searchJellyfin(query) {
  if (!process.env.JELLYFIN_URL || !process.env.JELLYFIN_API_KEY) return [];
  const data = await jellyfin.getItems({ search: query, startIndex: 0, limit: 8 });
  return (data.Items || []).map((item) => ({
    id: `jellyfin-${item.Id}`,
    type: item.Type === "Series" ? "series" : item.Type === "Movie" ? "movie" : "media",
    source: "jellyfin",
    name: item.Name || "Untitled",
    status: "In library",
    detail: item.ProductionYear ? String(item.ProductionYear) : "",
    action: { kind: "navigate", label: "Media", to: "/media" },
  }));
}

async function searchTorrents(query) {
  if (!qbittorrent.isConfigured()) return [];
  const torrents = await qbittorrent.getTorrents();
  const re = new RegExp(escapeRegExp(query), "i");
  return torrents
    .filter((torrent) => re.test(torrent.name || ""))
    .slice(0, 8)
    .map((torrent) => ({
      id: `qb-${torrent.hash}`,
      type: "download",
      source: "qbittorrent",
      name: torrent.name || "Unknown torrent",
      status: String(torrent.status || "unknown").replace(/^./, (c) => c.toUpperCase()),
      detail: torrent.progress != null ? `${Math.round(torrent.progress)}%` : "",
      action: { kind: "navigate", label: "Downloads", to: "/downloads" },
    }));
}

async function searchContainers(query) {
  const containers = await portainer.getContainers();
  const re = new RegExp(escapeRegExp(query), "i");
  return containers
    .filter((container) => {
      const name = ((container.Names || [])[0] || "").replace(/^\//, "");
      return re.test(name) || re.test(container.Image || "");
    })
    .slice(0, 8)
    .map((container) => ({
      id: `docker-${container.Id}`,
      type: "container",
      source: "docker",
      name: (container.Names || [])[0]?.replace(/^\//, "") || container.Id,
      status: container.State || "unknown",
      detail: container.Image || "",
      action: { kind: "navigate", label: "Docker", to: "/docker" },
    }));
}

function searchActivity(query) {
  const result = activity.list({ search: query, limit: 8 });
  return result.entries.map((entry) => ({
    id: `activity-${entry.id}`,
    type: "event",
    source: "activity",
    name: entry.message || entry.action || "Activity event",
    status: String(entry.severity || "info").replace(/^./, (c) => c.toUpperCase()),
    detail: entry.service,
    action: { kind: "navigate", label: "Activity", to: "/activity" },
  }));
}

/** Static REX OS page index — matched by page name and keywords. */
const PAGES = [
  { path: "/", name: "Dashboard", keywords: "home dashboard overview stats" },
  { path: "/pipeline", name: "Pipeline", keywords: "pipeline flow downloads media" },
  { path: "/diagnostics", name: "Diagnostics", keywords: "diagnostics health report checks" },
  { path: "/activity", name: "Activity", keywords: "activity log history events" },
  { path: "/notifications", name: "Notifications", keywords: "notifications alerts bell" },
  { path: "/system", name: "System Monitor", keywords: "system cpu memory monitor metrics nas" },
  { path: "/docker", name: "Docker", keywords: "docker containers portainer" },
  { path: "/storage", name: "Storage", keywords: "storage disk filesystem mount drive" },
  { path: "/media", name: "Media Center", keywords: "media movies tv jellyfin radarr sonarr anime" },
  { path: "/downloads", name: "Downloads", keywords: "downloads torrents qbittorrent pyload" },
  { path: "/photos", name: "Photos", keywords: "photos immich albums camera" },
  { path: "/cloud", name: "Cloud", keywords: "cloud nextcloud files" },
  { path: "/direct-link", name: "Direct Link", keywords: "direct link add url download pyload" },
  { path: "/search", name: "Search", keywords: "search global find" },
  { path: "/updates", name: "Updates", keywords: "update upgrade release version" },
  { path: "/backups", name: "Backups", keywords: "backup restore snapshot" },
  { path: "/recovery", name: "Recovery", keywords: "recovery rollback restore failover" },
  { path: "/settings", name: "Settings", keywords: "settings theme connections config" },
];

function searchPages(query) {
  const re = new RegExp(escapeRegExp(query), "i");
  return PAGES.filter(
    (page) => re.test(page.name) || re.test(page.keywords)
  ).map((page) => ({
    id: `page-${page.path}`,
    type: "page",
    source: "rexos",
    name: page.name,
    status: "REX OS page",
    detail: "",
    action: { kind: "navigate", label: "Open", to: page.path },
  }));
}

/* ------------------------------------------------------------------ */
/* Aggregate                                                           */
/* ------------------------------------------------------------------ */

/**
 * GET /api/search?q=... — grouped global results. Never throws: every
 * external source is isolated and its failure is reported in `errors`.
 */
async function search(rawQuery) {
  const query = cleanQuery(rawQuery);
  if (!query) {
    return { ok: true, query: "", results: [], errors: [], generatedAt: new Date().toISOString() };
  }

  const cached = hit(query);
  if (cached) return cached;

  const errors = [];
  const wrap = (label, fn) =>
    fn().catch((error) => {
      errors.push({ source: label, message: String(error.message || error).slice(0, 120) });
      return [];
    });

  const [movies, series, media, torrents, containers, events, pages] = await Promise.all([
    wrap("radarr", () => searchRadarr(query)),
    wrap("sonarr", () => searchSonarr(query)),
    wrap("jellyfin", () => searchJellyfin(query)),
    wrap("qbittorrent", () => searchTorrents(query)),
    wrap("docker", () => searchContainers(query)),
    wrap("activity", () => Promise.resolve(searchActivity(query))),
    wrap("pages", () => Promise.resolve(searchPages(query))),
  ]);

  const value = {
    ok: true,
    query,
    generatedAt: new Date().toISOString(),
    results: [
      ...movies,
      ...series,
      ...media,
      ...torrents,
      ...containers,
      ...events,
      ...pages,
    ],
    errors,
  };

  put(query, value);
  return value;
}

module.exports = { search, PAGES };
