const { execSync } = require("child_process");
const { storageLevel } = require("./diagnosticsService");
const systemMonitor = require("./systemMonitorService");

/**
 * REX OS Storage Dashboard — filesystem inventory + thresholds.
 *
 * Uses the SAME thresholds (REX_STORAGE_WARN / REX_STORAGE_CRIT via
 * diagnosticsService.storageLevel) and the same `df -Pk /` root reading as
 * Diagnostics, so every surface of the app agrees on storage numbers.
 */

/** Virtual/pseudo filesystems that are noise on a NAS dashboard. */
const VIRTUAL_TYPES = new Set([
  "tmpfs",
  "devtmpfs",
  "proc",
  "sysfs",
  "cgroup",
  "cgroup2",
  "devpts",
  "mqueue",
  "hugetlbfs",
  "securityfs",
  "debugfs",
  "tracefs",
  "pstore",
  "bpf",
  "autofs",
  "fusectl",
  "configfs",
  "ramfs",
  "overlay",
  "squashfs",
]);

/** All real filesystems (df -PkT), excluding virtual types and empty mounts. */
function getFilesystems() {
  try {
    const out = execSync("df -PkT 2>/dev/null", { encoding: "utf8", timeout: 5000 });
    const rows = [];
    for (const line of out.split("\n").slice(1)) {
      const fields = line.trim().split(/\s+/);
      if (fields.length < 7) continue;
      const [filesystem, type, blocks, used, avail, capacity, ...mountParts] = fields;
      const totalKb = parseInt(blocks, 10);
      const usedKb = parseInt(used, 10);
      const availKb = parseInt(avail, 10);
      if (!Number.isFinite(totalKb) || totalKb <= 0) continue;
      if (VIRTUAL_TYPES.has(type)) continue;
      const usePercent = Math.round((usedKb / totalKb) * 100);
      rows.push({
        filesystem,
        type,
        mount: mountParts.join(" "),
        total: totalKb * 1024,
        used: usedKb * 1024,
        free: availKb * 1024,
        usePercent,
        level: storageLevel(usePercent).level,
      });
    }
    // Most-used first so the eye lands on the fill-up risk.
    rows.sort((a, b) => b.usePercent - a.usePercent);
    return rows;
  } catch {
    return [];
  }
}

/** Root filesystem usage — identical numbers to Diagnostics. */
function getRootUsage() {
  try {
    const line = execSync("df -Pk /", { encoding: "utf8" }).split("\n")[1];
    const fields = line.trim().split(/\s+/);
    const totalKb = parseInt(fields[1], 10);
    const usedKb = parseInt(fields[2], 10);
    if (!totalKb) return null;
    const usedPercent = Math.round((usedKb / totalKb) * 100);
    return {
      usedPercent,
      total: totalKb * 1024,
      used: usedKb * 1024,
      free: (totalKb - usedKb) * 1024,
      level: storageLevel(usedPercent).level,
    };
  } catch {
    return null;
  }
}

/** Full storage report for GET /api/storage. */
async function getStorageReport() {
  const thresholds = storageLevel(0); // { warn, crit } from env
  const root = getRootUsage();
  const filesystems = getFilesystems();
  const io = await systemMonitor.getDiskIo();

  const warnings = filesystems
    .filter((fs) => fs.level !== "NORMAL")
    .map((fs) => ({
      mount: fs.mount,
      usedPercent: fs.usePercent,
      level: fs.level,
    }));

  return {
    generatedAt: new Date().toISOString(),
    root,
    thresholds: { warn: thresholds.warn, crit: thresholds.crit },
    filesystems,
    io,
    warnings,
    overall: root ? root.level : "UNKNOWN",
  };
}

module.exports = { getStorageReport, getFilesystems, getRootUsage };
