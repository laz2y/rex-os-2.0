const radarr = require("../services/radarrService");

/**
 * GET /api/radarr/overview — sanitized Radarr overview for the Media Center.
 *
 * Combines status, library size, missing count and recent history into one
 * payload so the frontend does not hammer Radarr with many requests. Each
 * block is fetched independently; a failing block never fails the endpoint.
 * Credentials never leave the server.
 */
exports.getOverview = async (req, res) => {
  try {
    if (!radarr.isConfigured()) {
      return res.json({
        ok: true,
        configured: false,
        status: "not_configured",
        detail: "Radarr is not configured on the server",
        movieCount: 0,
        missingCount: 0,
        queueCount: 0,
        recent: [],
      });
    }

    const [status, movies, missing, queue, history] = await Promise.all([
      radarr.getSystemStatus().catch((error) => ({ error })),
      radarr.getMovies().catch((error) => ({ error })),
      radarr.getMissing().catch((error) => ({ error })),
      radarr.getQueue().catch((error) => ({ error })),
      radarr.getHistory(12).catch((error) => ({ error })),
    ]);

    const failed = [status, movies, missing, queue, history].filter(
      (result) => result && result.error
    );
    const connected = failed.length === 0;

    const recent = connected
      ? history
          .filter((item) =>
            ["grabbed", "downloadFolderImported", "downloadFailed"].includes(
              item.eventType
            )
          )
          .map((item) => ({
            id: item.id,
            date: item.date,
            eventType: item.eventType,
            title: item.title,
            quality: item.quality,
          }))
      : [];

    const errorDetail = failed[0]?.error
      ? String(failed[0].error.message || failed[0].error).slice(0, 160)
      : null;

    res.json({
      ok: true,
      configured: true,
      status: connected ? "connected" : "error",
      detail: errorDetail || (status.version ? `v${status.version}` : "Connected"),
      version: status.version || null,
      movieCount: connected ? movies.length : 0,
      missingCount: connected ? missing : 0,
      queueCount: connected ? queue.totalRecords : 0,
      recent,
    });
  } catch (error) {
    console.error("[radarr] overview error:", error.message);
    res.status(500).json({ ok: false, error: "Failed to load Radarr overview." });
  }
};
