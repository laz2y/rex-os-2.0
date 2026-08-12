const pipeline = require("../services/pipelineService");

/**
 * GET /api/pipeline — full media pipeline status (pyLoad → qBittorrent →
 * Radarr/Sonarr → Jellyfin). Individual service failures never fail the
 * endpoint; each section carries its own status.
 */
exports.getPipeline = async (req, res) => {
  try {
    res.json(await pipeline.getPipeline());
  } catch (error) {
    console.error("[pipeline] unexpected error:", error.message);
    res.status(500).json({ ok: false, error: "Failed to assemble the pipeline." });
  }
};
