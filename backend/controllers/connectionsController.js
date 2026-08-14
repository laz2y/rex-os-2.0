const { runProbe, probeAll } = require("../services/probeRegistry");

/**
 * Service probes — now delegated to the shared probe registry
 * (backend/services/probeRegistry.js) so /api/system/connections,
 * /api/diagnostics and the auto-recovery monitor all use the same
 * server-side checks. Response shape is unchanged.
 */

/** GET /api/system/connections — status for every configured service. */
exports.getConnections = async (req, res) => {
  const services = await probeAll();

  res.json({ services });
};

/** POST /api/system/connections/:id/test — test a single service. */
exports.testConnection = async (req, res) => {
  const { id } = req.params;

  const result = await runProbe(id);
  if (result.detail === "Unknown service") {
    res.status(404).json({ status: "error", detail: "Unknown service" });
    return;
  }

  res.json(result);
};
