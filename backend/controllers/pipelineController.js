const pipeline = require("../services/pipelineService");
const probeRegistry = require("../services/probeRegistry");
const recovery = require("../services/recoveryService");
const portainer = require("../services/portainerService");
const activity = require("../services/activityService");
const notification = require("../services/notificationService");

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

/** Service ids restartable from the Pipeline Control Center. */
const RESTARTABLE = [
  "pyload",
  "qbittorrent",
  "radarr",
  "sonarr",
  "jellyfin",
  "nextcloud",
  "immich",
  "portainer",
];

const GROUPS = {
  downloads: ["pyload", "qbittorrent"],
  media: ["radarr", "sonarr", "jellyfin"],
  all: ["pyload", "qbittorrent", "radarr", "sonarr", "jellyfin"],
};

/**
 * Controlled restart of one pipeline service:
 * find container → restart → verify by probing → report + record.
 * Never blindly restarts; returns 409 when no matching container exists.
 */
async function restartOne(serviceId) {
  if (!RESTARTABLE.includes(serviceId)) {
    return { error: "Unknown service", status: 404 };
  }

  let containers;
  try {
    containers = await portainer.getContainers();
  } catch {
    return {
      error: "Portainer is unreachable — cannot restart containers from REX OS.",
      status: 502,
    };
  }

  const container = recovery.findContainer(serviceId, containers);
  if (!container) {
    return {
      error: `No ${serviceId} container found on this NAS — restart not possible.`,
      status: 409,
    };
  }

  const started = Date.now();
  pipeline.setOperation(`restart:${serviceId}`);

  try {
    await portainer.restartContainer(container.id);
  } catch (error) {
    console.error(`[pipeline] restart ${serviceId} failed:`, error.message);
    pipeline.setOperation(null);
    activity.record({
      type: "service_restart",
      service: serviceId,
      action: "restart",
      result: "error",
      message: `Failed to restart ${serviceId} (${container.name})`,
      severity: "error",
    });
    return { error: `Restart failed: ${error.response?.data?.message || error.message}`, status: 500 };
  }

  // Verify the service comes back healthy (probe until timeout).
  const verified = await recovery.verifyService(serviceId);
  const ms = Date.now() - started;
  pipeline.setOperation(null);

  if (verified.ok) {
    activity.record({
      type: "service_restart",
      service: serviceId,
      action: "restart",
      result: "success",
      message: `Restarted ${serviceId} (${container.name}) — healthy`,
      severity: "success",
    });
    notification.push({
      type: "service_restarted",
      service: serviceId,
      severity: "success",
      title: `${serviceId} restarted`,
      message: `${serviceId} was restarted and verified healthy.`,
      dedupeKey: `restarted:${serviceId}:${Math.floor(Date.now() / 86400000)}`,
    });
    return {
      ok: true,
      service: serviceId,
      container: container.name,
      verified: true,
      ms,
    };
  }

  activity.record({
    type: "service_restart",
    service: serviceId,
    action: "restart",
    result: "warning",
    message: `Restarted ${serviceId} (${container.name}) but health check timed out`,
    severity: "warning",
  });
  return {
    ok: true,
    service: serviceId,
    container: container.name,
    verified: false,
    ms,
    warning: "Container restarted but the service did not answer the health probe in time.",
  };
}

/** POST /api/pipeline/restart/:service — restart one service, verify, record. */
exports.restartService = async (req, res) => {
  const outcome = await restartOne(req.params.service);
  if (outcome.error) {
    return res.status(outcome.status).json({ ok: false, error: outcome.error });
  }
  res.json(outcome);
};

/**
 * POST /api/pipeline/restart-group — controlled group restart.
 * Services restart one at a time; each is verified before the next starts.
 */
exports.restartGroup = async (req, res) => {
  const { group } = req.body || {};
  const ids = GROUPS[group];
  if (!ids) {
    return res.status(400).json({ ok: false, error: `Unknown group "${group}"` });
  }

  const results = [];
  for (const id of ids) {
    const outcome = await restartOne(id);
    results.push({ id, ok: !outcome.error, ...outcome });
  }

  res.json({
    ok: true,
    group,
    results,
  });
};

/** GET /api/pipeline/recovery — current auto-recovery state (read-only). */
exports.getRecovery = (req, res) => {
  res.json(recovery.getStatus());
};
