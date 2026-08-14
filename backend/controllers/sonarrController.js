const sonarr = require("../services/sonarrService");

/**
 * GET /api/sonarr/overview — sanitized Sonarr overview for the Media Center.
 *
 * Same contract as the Radarr overview: independent per-block fetches, one
 * failing block never fails the endpoint, credentials stay server-side.
 */
exports.getOverview = async (req, res) => {
  try {
    if (!sonarr.isConfigured()) {
      return res.json({
        ok: true,
        configured: false,
        status: "not_configured",
        detail: "Sonarr is not configured on the server",
        seriesCount: 0,
        missingCount: 0,
        queueCount: 0,
        recent: [],
      });
    }

    const [status, series, missing, queue, history] = await Promise.all([
      sonarr.getSystemStatus().catch((error) => ({ error })),
      sonarr.getSeries().catch((error) => ({ error })),
      sonarr.getMissing().catch((error) => ({ error })),
      sonarr.getQueue().catch((error) => ({ error })),
      sonarr.getHistory(12).catch((error) => ({ error })),
    ]);

    const failed = [status, series, missing, queue, history].filter(
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
            detail: item.detail,
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
      seriesCount: connected ? series.length : 0,
      missingCount: connected ? missing : 0,
      queueCount: connected ? queue.totalRecords : 0,
      recent,
    });
  } catch (error) {
    console.error("[sonarr] overview error:", error.message);
    res.status(500).json({ ok: false, error: "Failed to load Sonarr overview." });
  }
};
