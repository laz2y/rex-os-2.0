const os = require("os");
const fs = require("fs");
const { execSync } = require("child_process");

/** Formats a duration in seconds as "3d 12h 5m". */
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes || !parts.length) parts.push(`${minutes}m`);
  return parts.join(" ");
}

/** Best-effort disk usage for the root filesystem (returns null when unavailable). */
function getStorageUsage() {
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
    };
  } catch {
    return null;
  }
}

/** Reads the CPU temperature from sysfs when exposed (null on non-Linux hosts). */
function getTemperature() {
  try {
    const raw = fs
      .readFileSync("/sys/class/thermal/thermal_zone0/temp", "utf8")
      .trim();
    const millidegrees = parseInt(raw, 10);
    if (Number.isFinite(millidegrees)) return Math.round(millidegrees / 1000);
  } catch {
    /* thermal zone not exposed */
  }
  return null;
}

exports.getSystem = (req, res) => {
  const cpus = os.cpus();
  const cores = cpus.length || 1;
  const loadAvg = os.loadavg();

  // 1-minute load average as a rough percentage of available cores.
  const cpu = Math.max(0, Math.min(100, Math.round((loadAvg[0] / cores) * 100)));

  const totalMem = os.totalmem();
  const usedMem = totalMem - os.freemem();
  const ram = totalMem ? Math.round((usedMem / totalMem) * 100) : 0;

  const storage = getStorageUsage();
  const uptimeSeconds = os.uptime();

  res.json({
    cpu,
    ram,
    storage: storage ? storage.usedPercent : 0,
    temperature: getTemperature(),
    uptime: formatUptime(uptimeSeconds),
    uptimeSeconds,
    loadAvg: loadAvg.map((value) => Number(value.toFixed(2))),
    cores,
    hostname: os.hostname(),
    platform: os.platform(),
    os: `${os.type()} ${os.release()}`,
    arch: os.arch(),
    memory: {
      total: totalMem,
      used: usedMem,
    },
    storageDetail: storage,
  });
};
