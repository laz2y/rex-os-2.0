const axios = require("axios");

/**
 * Service probes. Each probe runs entirely server-side using the backend
 * environment credentials — no token/URL/key ever reaches the browser.
 * Detail strings are sanitized (versions / short labels only).
 */
const SERVICES = {
  jellyfin: {
    name: "Jellyfin",
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
    probe: async () => {
      if (!process.env.QBITTORRENT_URL) throw new Error("not configured");
      const params = new URLSearchParams({
        username: process.env.QBITTORRENT_USERNAME || "",
        password: process.env.QBITTORRENT_PASSWORD || "",
      });
      const { data } = await axios.post(
        `${process.env.QBITTORRENT_URL}/api/v2/auth/login`,
        params.toString(),
        {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          timeout: 8000,
        }
      );
      if (String(data).trim() === "Ok.") return "authenticated";
      throw new Error("login rejected");
    },
  },
};

/** Run one probe, mapping failures to offline (network) vs error (HTTP/auth). */
async function runProbe(id) {
  const started = Date.now();

  try {
    const detail = await SERVICES[id].probe();
    return { id, status: "connected", detail, ms: Date.now() - started };
  } catch (error) {
    const status = error.response ? "error" : "offline";
    const detail = error.response?.status
      ? `HTTP ${error.response.status}`
      : String(error.message || "unreachable");

    return { id, status, detail, ms: Date.now() - started };
  }
}

/** GET /api/system/connections — status for every configured service. */
exports.getConnections = async (req, res) => {
  const results = await Promise.all(Object.keys(SERVICES).map(runProbe));

  res.json({
    services: Object.fromEntries(results.map((result) => [result.id, result])),
  });
};

/** POST /api/system/connections/:id/test — test a single service. */
exports.testConnection = async (req, res) => {
  const { id } = req.params;

  if (!SERVICES[id]) {
    res.status(404).json({ status: "error", detail: "Unknown service" });
    return;
  }

  res.json(await runProbe(id));
};
