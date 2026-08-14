const os = require("os");
const { execSync } = require("child_process");
const portainer = require("./portainerService");
const pipeline = require("./pipelineService");
const probeRegistry = require("./probeRegistry");
const activity = require("./activityService");

/**
 * REX OS Diagnostics — builds a PASS / WARNING / CRITICAL report across
 * SYSTEM, DOCKER, SERVICES, NETWORK and STORAGE. Every check is real and
 * runs server-side; nothing is faked when a capability is missing (e.g.
 * temperatures are omitted rather than invented).
 */

/** Read root filesystem usage via df (null when unavailable). */
function getStorage() {
  try {
    const line = execSync("df -Pk /", { encoding: "utf8" }).split("\n")[1];
    const fields = line.trim().split(/\s+/);
    const totalKb = parseInt(fields[1], 10);
    const usedKb = parseInt(fields[2], 10);
    if (!totalKb) return null;
    return {
      usedPercent: Math.round((usedKb / totalKb) * 100),
      total: totalKb * 1024,
      used: usedKb * 1024,
      free: (totalKb - usedKb) * 1024,
    };
  } catch {
    return null;
  }
}

/** Storage level from configurable thresholds (default 70% warn / 85% crit). */
function storageLevel(usedPercent) {
  const warn = Number.parseInt(process.env.REX_STORAGE_WARN, 10) || 70;
  const crit = Number.parseInt(process.env.REX_STORAGE_CRIT, 10) || 85;
  const level = usedPercent >= crit ? "CRITICAL" : usedPercent >= warn ? "WARNING" : "NORMAL";
  return { level, warn, crit };
}

function systemSection() {
  const checks = [];

  const cpus = os.cpus();
  const cores = cpus.length || 1;
  const loadAvg = os.loadavg();
  const cpu = Math.max(0, Math.min(100, Math.round((loadAvg[0] / cores) * 100)));
  checks.push({ name: "CPU", status: cpu > 90 ? "WARNING" : "PASS", detail: `${cpu}% (load ${loadAvg[0].toFixed(2)})` });

  const totalMem = os.totalmem();
  const usedMem = totalMem - os.freemem();
  const ram = totalMem ? Math.round((usedMem / totalMem) * 100) : 0;
  checks.push({ name: "RAM", status: ram > 90 ? "WARNING" : "PASS", detail: `${ram}% used (${(usedMem / 1073741824).toFixed(1)} / ${(totalMem / 1073741824).toFixed(1)} GB)` });

  const uptimeDays = os.uptime() / 86400;
  checks.push({ name: "Uptime", status: "PASS", detail: `${uptimeDays.toFixed(1)} days` });

  const storage = getStorage();
  if (storage) {
    const { level } = storageLevel(storage.usedPercent);
    checks.push({
      name: "Disk",
      status: level === "CRITICAL" ? "CRITICAL" : level === "WARNING" ? "WARNING" : "PASS",
      detail: `${storage.usedPercent}% used`,
    });
  } else {
    checks.push({ name: "Disk", status: "WARNING", detail: "Unavailable on this host" });
  }

  const status = checks.some((c) => c.status === "CRITICAL")
    ? "CRITICAL"
    : checks.some((c) => c.status === "WARNING")
    ? "WARNING"
    : "PASS";

  return { status, checks };
}

async function dockerSection() {
  try {
    const containers = await portainer.getContainers();

    const running = containers.filter((c) => c.State === "running").length;
    const stopped = containers.length - running;
    const restarting = containers.filter((c) => /restarting/i.test(c.Status || "")).length;
    const unhealthy = containers.filter((c) => /unhealthy/i.test(c.Status || "")).length;

    const checks = [
      { name: "Docker daemon", status: "PASS", detail: `v${process.env.PORTAINER_ENDPOINT_ID || 1} endpoint reachable` },
      { name: "Containers", status: "PASS", detail: `${containers.length} total (${running} running, ${stopped} stopped)` },
    ];

    if (unhealthy > 0) {
      checks.push({ name: "Health", status: "WARNING", detail: `${unhealthy} container(s) unhealthy` });
    }
    if (restarting > 0) {
      checks.push({ name: "Restart loop", status: "WARNING", detail: `${restarting} container(s) restarting` });
    }

    const status = checks.some((c) => c.status === "CRITICAL")
      ? "CRITICAL"
      : checks.some((c) => c.status === "WARNING")
      ? "WARNING"
      : "PASS";

    return { status, checks, counts: { total: containers.length, running, stopped } };
  } catch (error) {
    console.error(`[diagnostics] docker: ${error.message}`);
    return {
      status: "FAIL",
      checks: [
        { name: "Docker daemon", status: "FAIL", detail: String(error.response?.data?.message || error.message || "Unreachable") },
      ],
    };
  }
}

async function servicesSection() {
  const results = await probeRegistry.probeAll();
  const entries = Object.values(results).map((result) => ({
    id: result.id,
    name: probeRegistry.PROBES[result.id]?.name || result.id,
    configured: probeRegistry.isConfigured(result.id),
    ...result,
  }));

  const failed = entries.filter((entry) => ["offline", "error", "auth_failed"].includes(entry.status));
  const status = failed.length === 0
    ? "PASS"
    : entries.filter((entry) => entry.status === "connected").length === 0
    ? "FAIL"
    : "WARNING";

  return { status, services: entries, failedCount: failed.length };
}

const APP_VERSION = "2.4.0";

function networkSection(services) {
  const failed = services.filter((entry) => ["offline", "error", "auth_failed"].includes(entry.status));
  const status = failed.length === 0 ? "PASS" : failed.length === services.length ? "FAIL" : "WARNING";
  return {
    status,
    checks: [
      { name: "Service endpoints", status, detail: `${services.length - failed.length}/${services.length} endpoints reachable` },
      { name: "REX backend", status: "PASS", detail: `self v${APP_VERSION}` },
    ],
  };
}

async function storageSection() {
  const storage = getStorage();
  if (!storage) {
    return { status: "WARNING", detail: "Unavailable on this host", level: "UNKNOWN", thresholds: storageLevel(0) };
  }

  const { level, warn, crit } = storageLevel(storage.usedPercent);
  return {
    status: level === "CRITICAL" ? "CRITICAL" : level === "WARNING" ? "WARNING" : "PASS",
    usedPercent: storage.usedPercent,
    total: storage.total,
    used: storage.used,
    free: storage.free,
    level,
    thresholds: { warn, crit },
  };
}

/** Build the full report — every section runs live. Never throws. */
async function runDiagnostics() {
  const started = Date.now();

  const [system, docker, services, pipelineReport, storage] = await Promise.all([
    systemSection(),
    dockerSection(),
    servicesSection(),
    pipeline.getPipeline().catch(() => ({ ok: false, error: "Pipeline unavailable" })),
    storageSection(),
  ]);

  const network = networkSection(services.services || []);

  // The pipeline's own overall state feeds the services/network summary.
  const pipelineState = pipelineReport.pipeline ? pipelineReport.pipeline.state : "DEGRADED";

  const summary = {
    system: system.status,
    docker: docker.status,
    services: services.status,
    network: network.status,
    storage: storage.status,
    pipeline: pipelineState === "SUCCESS" || pipelineState === "IDLE" ? "PASS" : pipelineState === "FAILED" ? "CRITICAL" : "WARNING",
  };

  const report = {
    ok: true,
    runAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    summary,
    sections: {
      system,
      docker,
      services,
      network,
      storage,
    },
    pipeline: pipelineReport,
  };

  activity.record({
    type: "diagnostics",
    service: "rexos",
    action: "run_diagnostics",
    result: Object.values(summary).every((status) => status === "PASS") ? "success" : "warning",
    message: `Diagnostics: system ${summary.system}, docker ${summary.docker}, services ${summary.services}, storage ${summary.storage}, pipeline ${summary.pipeline}`,
    severity: Object.values(summary).some((status) => status === "CRITICAL")
      ? "error"
      : Object.values(summary).some((status) => status === "WARNING")
      ? "warning"
      : "info",
  });

  return report;
}

module.exports = {
  runDiagnostics,
  getStorage,
  storageLevel,
};
