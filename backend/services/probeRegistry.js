const axios = require("axios");
const pyLoad = require("./pyLoadService");
const qbittorrent = require("./qBittorrentService");

/**
 * Server-side service probes — the single source of truth for "is service X
 * reachable?" used by /api/system/connections, /api/diagnostics and the
 * auto-recovery monitor. Every probe runs entirely on the server using the
 * backend environment credentials — no token/URL/key ever reaches the
 * browser. Detail strings are sanitized (versions / short labels only).
 */
const PROBES = {
  jellyfin: {
    name: "Jellyfin",
    category: "media",
    probe: async () => {
      if (!process.env.JELLYFIN_URL || !process.env.JELLYFIN_API_KEY) {
        throw new Error("not configured");
      }
      const { data } = await axios.get(`${process.env.JELLYFIN_URL}/System/Info`, {
        headers: { "X-Emby-Token": process.env.JELLYFIN_API_KEY },
        timeout: 8000,
      });
      return data.Version ? `v${data.Version}` : "reachable";
    },
  },
  nextcloud: {
    name: "Nextcloud",
    category: "cloud",
    probe: async () => {
      if (!process.env.NEXTCLOUD_URL) throw new Error("not configured");
      const { data } = await axios.get(`${process.env.NEXTCLOUD_URL}/status.php`, {
        auth:
          process.env.NEXTCLOUD_USERNAME && process.env.NEXTCLOUD_PASSWORD
            ? {
                username: process.env.NEXTCLOUD_USERNAME,
                password: process.env.NEXTCLOUD_PASSWORD,
              }
            : undefined,
        timeout: 8000,
      });
      return data.versionstring ? `v${data.versionstring}` : "reachable";
    },
  },
  immich: {
    name: "Immich",
    category: "photos",
    probe: async () => {
      if (!process.env.IMMICH_URL || !process.env.IMMICH_API_KEY) {
        throw new Error("not configured");
      }
      const { data } = await axios.get(`${process.env.IMMICH_URL}/api/server/ping`, {
        headers: { "x-api-key": process.env.IMMICH_API_KEY },
        timeout: 8000,
      });
      return data?.res === "pong" ? "pong" : "reachable";
    },
  },
  portainer: {
    name: "Portainer",
    category: "system",
    probe: async () => {
      if (!process.env.PORTAINER_URL || !process.env.PORTAINER_API_TOKEN) {
        throw new Error("not configured");
      }
      const { data } = await axios.get(
        `${process.env.PORTAINER_URL}/api/endpoints/${
          process.env.PORTAINER_ENDPOINT_ID || 1
        }/docker/info`,
        { headers: { "X-API-Key": process.env.PORTAINER_API_TOKEN }, timeout: 8000 }
      );
      return data.ServerVersion ? `v${data.ServerVersion}` : "reachable";
    },
  },
  qbittorrent: {
    name: "qBittorrent",
    category: "downloads",
    probe: async () => {
      if (!qbittorrent.isConfigured()) throw new Error("not configured");
      const version = await qbittorrent.probe();
      return version && version !== "reachable" ? version : "reachable";
    },
  },
  pyload: {
    name: "pyLoad",
    category: "downloads",
    probe: async () => {
      if (!pyLoad.isConfigured()) throw new Error("not configured");
      const version = await pyLoad.probe();
      return version && version !== "reachable" ? `v${version}` : "reachable";
    },
  },
};

/** Container-name patterns used to map a service to its Docker container. */
const CONTAINER_PATTERNS = {
  pyload: [/pyload/i],
  qbittorrent: [/qbittorrent|qb\b/i],
  radarr: [/radarr/i],
  sonarr: [/sonarr/i],
  jellyfin: [/jellyfin/i],
  nextcloud: [/nextcloud/i],
  immich: [/immich/i],
  portainer: [/portainer/i],
};

/** True when the service is configured (has credentials/URL on the server). */
function isConfigured(id) {
  const probe = PROBES[id];
  if (!probe) return false;
  try {
    if (id === "pyload") return pyLoad.isConfigured();
    if (id === "qbittorrent") return qbittorrent.isConfigured();
    switch (id) {
      case "jellyfin":
        return Boolean(process.env.JELLYFIN_URL && process.env.JELLYFIN_API_KEY);
      case "nextcloud":
        return Boolean(process.env.NEXTCLOUD_URL);
      case "immich":
        return Boolean(process.env.IMMICH_URL && process.env.IMMICH_API_KEY);
      case "portainer":
        return Boolean(process.env.PORTAINER_URL && process.env.PORTAINER_API_TOKEN);
      default:
        return false;
    }
  } catch {
    return false;
  }
}

/** Run one probe, mapping failures to offline (network) vs error (HTTP/auth). */
async function runProbe(id) {
  const started = Date.now();
  const probe = PROBES[id];

  if (!probe) {
    return { id, status: "error", detail: "Unknown service", ms: 0 };
  }

  try {
    const detail = await probe.probe();
    return { id, status: "connected", detail, ms: Date.now() - started };
  } catch (error) {
    const status = error.response ? "error" : "offline";
    const detail = error.response?.status
      ? `HTTP ${error.response.status}`
      : String(error.message || "unreachable");

    return { id, status, detail, ms: Date.now() - started };
  }
}

/** Probe every configured service in parallel. */
async function probeAll() {
  const results = await Promise.all(Object.keys(PROBES).map(runProbe));
  return Object.fromEntries(results.map((result) => [result.id, result]));
}

module.exports = {
  PROBES,
  CONTAINER_PATTERNS,
  isConfigured,
  runProbe,
  probeAll,
};
