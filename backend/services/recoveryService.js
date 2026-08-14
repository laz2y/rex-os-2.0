const probeRegistry = require("./probeRegistry");
const portainer = require("./portainerService");
const pipeline = require("./pipelineService");
const stateStore = require("./stateStore");
const activity = require("./activityService");
const notification = require("./notificationService");
const qbittorrent = require("./qBittorrentService");
const pyLoad = require("./pyLoadService");
const diagnostics = require("./diagnosticsService");

/**
 * REX OS Auto-Recovery.
 *
 * A background monitor probes every configured service, detects failures
 * (container stopped, container crash, application health failure, download
 * failure, storage thresholds) and attempts a controlled recovery:
 *
 *   detect → record → restart/start container → verify → SUCCESS
 *                                  ↘ retry (max attempts) → cooldown → FAILED
 *
 * Guard rails (never aggressive):
 *   - Probes run at most once per REX_MONITOR_MS (default 60s).
 *   - At most REX_RECOVERY_MAX_ATTEMPTS (default 3) per failure window.
 *   - After exhausting attempts the service is marked FAILED and enters a
 *     REX_RECOVERY_COOLDOWN_MS (default 10 min) before it is tried again.
 *   - Alerts are deduplicated (one unread notification per event key).
 *   - A slow cycle never overlaps the next (single-flight guard).
 *
 * State persists in backend/data/recovery.json so it survives restarts.
 */

const MONITOR_MS = Math.max(10000, Number.parseInt(process.env.REX_MONITOR_MS, 10) || 60000);
const MAX_ATTEMPTS = Math.max(1, Number.parseInt(process.env.REX_RECOVERY_MAX_ATTEMPTS, 10) || 3);
const COOLDOWN_MS = Math.max(30000, Number.parseInt(process.env.REX_RECOVERY_COOLDOWN_MS, 10) || 600000);
const VERIFY_WAIT_MS = Math.max(1000, Number.parseInt(process.env.REX_RECOVERY_VERIFY_MS, 10) || 4000);
const VERIFY_ATTEMPTS = 5; // ~20s of verification after an action

let timer = null;
let running = false;
let lastStorageLevel = null;
let containerCache = [];

function readState() {
  return stateStore.readJson("recovery", { services: {} });
}

function writeState(state) {
  stateStore.writeJson("recovery", state);
}

function getServiceState(state, id) {
  const entry = state.services[id] || {
    state: "unknown",
    attempts: 0,
    lastAttemptAt: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    cooldownUntil: null,
    container: null,
  };
  state.services[id] = entry;
  return entry;
}

/** Find the Docker container for a service via the name patterns. */
function findContainer(serviceId, containers) {
  const patterns = probeRegistry.CONTAINER_PATTERNS[serviceId];
  if (!patterns) return null;
  for (const container of containers) {
    const name = (container.Names && container.Names[0]) || "";
    if (patterns.some((pattern) => pattern.test(name))) {
      return { id: container.Id, name: name.replace(/^\//, ""), state: container.State, status: container.Status };
    }
  }
  return null;
}

/** Wait VERIFY_WAIT_MS and re-probe the service until healthy or timeout. */
async function verifyService(id) {
  for (let attempt = 0; attempt < VERIFY_ATTEMPTS; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, VERIFY_WAIT_MS));
    const result = await probeRegistry.runProbe(id);
    if (result.status === "connected") return { ok: true, detail: result.detail };
  }
  return { ok: false };
}

async function recordFailure(state, id, entry, detail) {
  entry.state = "failed";
  entry.lastFailureAt = new Date().toISOString();
  entry.cooldownUntil = Date.now() + COOLDOWN_MS;

  activity.record({
    type: "recovery",
    service: id,
    action: "service_failed",
    result: "error",
    message: `${id} unavailable — ${detail}`,
    severity: "error",
  });

  notification.push({
    type: "service_failed",
    service: id,
    severity: "critical",
    title: `${id} failed`,
    message: `${id} did not recover after ${entry.attempts} attempts — rechecking after cooldown.`,
    dedupeKey: `recovery-failed:${id}:${Math.floor(Date.now() / COOLDOWN_MS)}`,
  });

  writeState(state);
}

async function recordRecovery(state, id, entry, containerName) {
  entry.state = "healthy";
  entry.attempts = 0;
  entry.lastSuccessAt = new Date().toISOString();
  entry.cooldownUntil = null;

  activity.record({
    type: "recovery",
    service: id,
    action: "service_recovered",
    result: "success",
    message: `${id} recovered${containerName ? ` (container ${containerName})` : ""}`,
    severity: "success",
  });

  notification.push({
    type: "service_recovered",
    service: id,
    severity: "success",
    title: `${id} recovered`,
    message: `${id} is healthy again.`,
    dedupeKey: `recovery-ok:${id}:${Math.floor(Date.now() / 86400000)}`,
  });

  writeState(state);
}

/** Attempt a container action for a failed service; returns container used. */
async function attemptRecovery(id) {
  // Fresh container list so the restart target is current.
  let containers = containerCache;
  try {
    containers = await portainer.getContainers();
    containerCache = containers;
  } catch {
    /* Portainer unreachable — fall back to the cached list */
  }

  const container = findContainer(id, containers);
  if (!container) {
    return { restarted: false, container: null, reason: "No matching container found on this NAS" };
  }

  try {
    // Stopped/crashed container → start it; running but unhealthy → restart.
    if (container.state === "running") {
      await portainer.restartContainer(container.id);
      return { restarted: true, container: container.name, action: "restart" };
    }
    await portainer.startContainer(container.id);
    return { restarted: true, container: container.name, action: "start" };
  } catch (error) {
    console.error(`[recovery] ${id} container action failed: ${error.message}`);
    return { restarted: false, container: container.name, reason: "Container action failed" };
  }
}

/** One monitoring cycle — probe everything, act on failures. */
async function cycle() {
  const state = readState();

  // 1. Probe every configured service.
  const probes = await probeRegistry.probeAll();

  // 2. Container list for restart targets + container-state detection.
  try {
    containerCache = await portainer.getContainers();
  } catch {
    /* keep cached list */
  }

  for (const [id, result] of Object.entries(probes)) {
    const entry = getServiceState(state, id);
    const container = findContainer(id, containerCache);

    if (result.status === "connected") {
      if (entry.state === "failed" || entry.state === "recovering") {
        await recordRecovery(state, id, entry, container?.name || null);
      } else {
        entry.state = "healthy";
        entry.lastSuccessAt = entry.lastSuccessAt || new Date().toISOString();
      }
      continue;
    }

    if (result.status === "not_configured") continue;

    // Service is down. Cooldown gate — never hammer a failing service.
    if (entry.cooldownUntil && Date.now() < entry.cooldownUntil) continue;

    // Container stopped while service configured → treat as failure too.
    if (container && container.state !== "running" && result.status === "offline") {
      activity.record({
        type: "recovery",
        service: id,
        action: "container_stopped",
        result: "warning",
        message: `${container.name} is ${container.state} — ${id} offline`,
        severity: "warning",
      });
      notification.push({
        type: "container_stopped",
        service: id,
        severity: "warning",
        title: `${container.name} stopped`,
        message: `Container for ${id} is not running.`,
        dedupeKey: `container-stopped:${id}:${container.id}`,
      });
    }

    entry.state = "recovering";
    entry.attempts += 1;
    entry.lastAttemptAt = new Date().toISOString();
    entry.container = container ? container.name : null;

    if (entry.attempts > MAX_ATTEMPTS) {
      await recordFailure(state, id, entry, result.detail);
      continue;
    }

    activity.record({
      type: "recovery",
      service: id,
      action: "recovery_attempt",
      result: "warning",
      message: `Attempt ${entry.attempts}/${MAX_ATTEMPTS} to recover ${id}`,
      severity: "warning",
    });

    pipeline.setRecovering(true);
    pipeline.setOperation(`recovering:${id}`);

    try {
      const outcome = await attemptRecovery(id);
      const verified = await verifyService(id);

      if (verified.ok) {
        await recordRecovery(state, id, entry, outcome.container);
      } else if (outcome.restarted) {
        activity.record({
          type: "recovery",
          service: id,
          action: "recovery_attempt",
          result: "error",
          message: `${id} still unreachable after ${outcome.action} (attempt ${entry.attempts}/${MAX_ATTEMPTS})`,
          severity: "warning",
        });
        writeState(state);
      } else {
        activity.record({
          type: "recovery",
          service: id,
          action: "recovery_attempt",
          result: "error",
          message: `${id}: ${outcome.reason}`,
          severity: "warning",
        });
        writeState(state);
      }
    } finally {
      pipeline.setRecovering(false);
      pipeline.setOperation(null);
    }
  }

  // 3. Storage thresholds (NORMAL / WARNING / CRITICAL).
  await checkStorage(state);

  // 4. Download failures (qBittorrent error torrents, pyLoad failed links).
  await checkDownloadFailures(state);
}

async function checkStorage(state) {
  const storage = diagnostics.getStorage();
  if (!storage) return;

  const { level } = diagnostics.storageLevel(storage.usedPercent);
  if (level === lastStorageLevel) return;

  const day = new Date().toISOString().slice(0, 10);
  if (lastStorageLevel !== null) {
    if (level === "CRITICAL") {
      notification.push({
        type: "storage_critical",
        service: "storage",
        severity: "critical",
        title: "Storage critical",
        message: `Root filesystem is ${storage.usedPercent}% full — free space is running out.`,
        dedupeKey: `storage-critical:${day}`,
      });
      activity.record({
        type: "storage",
        service: "storage",
        action: "storage_critical",
        result: "error",
        message: `Storage at ${storage.usedPercent}% used`,
        severity: "critical",
      });
    } else if (level === "WARNING") {
      notification.push({
        type: "storage_warning",
        service: "storage",
        severity: "warning",
        title: "Storage warning",
        message: `Root filesystem is at ${storage.usedPercent}% capacity.`,
        dedupeKey: `storage-warning:${day}`,
      });
      activity.record({
        type: "storage",
        service: "storage",
        action: "storage_warning",
        result: "warning",
        message: `Storage at ${storage.usedPercent}% used`,
        severity: "warning",
      });
    }
  }
  lastStorageLevel = level;
}

async function checkDownloadFailures() {
  // qBittorrent error/missing torrents.
  if (qbittorrent.isConfigured()) {
    try {
      const torrents = await qbittorrent.getTorrents();
      const failed = torrents.filter((t) => t.status === "error" || t.status === "missing");
      for (const torrent of failed.slice(0, 5)) {
        notification.push({
          type: "download_failed",
          service: "qbittorrent",
          severity: "error",
          title: "Download failed",
          message: `qBittorrent: ${torrent.name}`,
          dedupeKey: `qb-failed:${torrent.hash}`,
        });
      }
    } catch {
      /* qBittorrent already flagged by the service probe */
    }
  }

  // pyLoad failed packages.
  if (pyLoad.isConfigured()) {
    try {
      const downloads = await pyLoad.getDownloads();
      const failed = downloads.filter((d) => d.state === "failed");
      for (const item of failed.slice(0, 5)) {
        notification.push({
          type: "download_failed",
          service: "pyload",
          severity: "error",
          title: "Download failed",
          message: `pyLoad: ${item.name}`,
          dedupeKey: `pyload-failed:${item.fid}`,
        });
      }
    } catch {
      /* pyLoad already flagged by the service probe */
    }
  }
}

/** Start the monitor (idempotent). */
function start() {
  if (timer) return;
  // First cycle shortly after boot, then on the interval.
  setTimeout(() => {
    if (!running) {
      running = true;
      cycle()
        .catch((error) => console.error(`[recovery] cycle error: ${error.message}`))
        .finally(() => {
          running = false;
        });
    }
  }, 3000);
  timer = setInterval(() => {
    if (running) return; // never overlap cycles
    running = true;
    cycle()
      .catch((error) => console.error(`[recovery] cycle error: ${error.message}`))
      .finally(() => {
        running = false;
      });
  }, MONITOR_MS);
  console.log(`🛟 Auto-recovery monitor started (every ${MONITOR_MS / 1000}s, max ${MAX_ATTEMPTS} attempts, ${COOLDOWN_MS / 1000}s cooldown)`);
}

/** Stop the monitor (used by tests). */
function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}

/** Current recovery status (service states + recent history summary). */
function getStatus() {
  const state = readState();
  const entries = Object.entries(state.services).map(([id, entry]) => ({
    id,
    state: entry.state,
    attempts: entry.attempts,
    lastAttemptAt: entry.lastAttemptAt,
    lastSuccessAt: entry.lastSuccessAt,
    lastFailureAt: entry.lastFailureAt,
    container: entry.container,
  }));
  return {
    monitorMs: MONITOR_MS,
    maxAttempts: MAX_ATTEMPTS,
    cooldownMs: COOLDOWN_MS,
    services: entries,
  };
}

module.exports = {
  start,
  stop,
  cycle,
  getStatus,
  verifyService,
  findContainer,
};
