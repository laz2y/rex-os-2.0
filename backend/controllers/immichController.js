const immich = require("../services/immichService");

function nowIso() {
  return new Date().toISOString();
}

/** GET /api/immich/overview — real Immich stats, each field best-effort. */
exports.getOverview = async (req, res) => {
  const checked = nowIso();

  try {
    if (!process.env.IMMICH_URL || !process.env.IMMICH_API_KEY) {
      throw new Error("IMMICH_URL/IMMICH_API_KEY not configured");
    }

    const [ping, version, statistics, albums] = await Promise.allSettled([
      immich.ping(),
      immich.getVersion(),
      immich.getStatistics(),
      immich.getAlbums(),
    ]);

    const online = ping.status === "fulfilled" && ping.value?.res === "pong";

    const versionValue =
      version.status === "fulfilled" && version.value
        ? `v${version.value.major}.${version.value.minor}.${version.value.patch}`
        : null;

    const statsValue =
      statistics.status === "fulfilled" && statistics.value
        ? {
            photos: Number(statistics.value.photos) || 0,
            videos: Number(statistics.value.videos) || 0,
            total: Number(statistics.value.total) || 0,
          }
        : null;

    const albumsValue =
      albums.status === "fulfilled" && Array.isArray(albums.value)
        ? albums.value.slice(0, 12).map((album) => ({
            id: album.id || null,
            name: album.albumName || "Untitled",
            assetCount: Number(album.assetCount) || 0,
            createdAt: album.createdAt || null,
          }))
        : null;

    res.json({
      online,
      version: versionValue,
      statistics: statsValue,
      albums: albumsValue,
      lastChecked: checked,
    });
  } catch (error) {
    console.error("[Immich] overview:", error.response?.data || error.message);

    res.json({
      online: false,
      version: null,
      statistics: null,
      albums: null,
      lastChecked: checked,
    });
  }
};
