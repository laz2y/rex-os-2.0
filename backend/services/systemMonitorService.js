const os = require("os");
const fs = require("fs");
const { execSync } = require("child_process");
const portainer = require("./portainerService");

/**
 * REX OS System Monitoring — the shared, cached source of real NAS metrics
 * used by GET /api/system/metrics (and reusable by Storage / Diagnostics).
 *
 * Rules:
 *  - Every value is real host data (Linux /proc + os.*); nothing is invented.
 *  - Anything unavailable on the host is returned as null so the UI can show
 *    "Unavailable" instead of breaking.
 *  - Sampling (CPU delta, 1s network/disk windows) is cached so polling
 *    frontends never hammer the host.
 */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* ------------------------------------------------------------------ */
/* CPU — real utilization from /proc/stat deltas (cached 1.2s window)  */
/* ------------------------------------------------------------------ */

function readCpuTimes() {
  const line = fs.readFileSync("/proc/stat", "utf8").split("\n")[0];
  const parts = line.trim().split(/\s+/).slice(1).map(Number);
  // parts: user nice system idle iowait irq softirq steal guest guest_nice
  const idle = (parts[3] || 0) + (parts[4] || 0);
  const total = parts.reduce((sum, value) => sum + (value || 0), 0);
  return { idle, total };
}

let cpuLast = null;
let cpuLastValue = null;

/** CPU usage % computed from consecutive /proc/stat samples. */
function getCpuUsage() {
  try {
    const current = readCpuTimes();
    if (!cpuLast) {
      cpuLast = current;
      return cpuLastValue ?? 0;
    }
    const deltaTotal = current.total - cpuLast.total;
    const deltaIdle = current.idle - cpuLast.idle;
    cpuLast = current;
    if (deltaTotal <= 0) return cpuLastValue ?? 0;
    cpuLastValue = Math.max(
      0,
      Math.min(100, Math.round(((deltaTotal - deltaIdle) / deltaTotal) * 100))
    );
    return cpuLastValue;
  } catch {
    // Fallback: load-average estimate (approximation, not a fake metric).
    const cores = os.cpus().length || 1;
    return Math.max(
      0,
      Math.min(100, Math.round((os.loadavg()[0] / cores) * 100))
    );
  }
}

/* ------------------------------------------------------------------ */
/* Memory + swap — /proc/meminfo with os fallback                      */
/* ------------------------------------------------------------------ */

function getMemory() {
  const total = os.totalmem();
  const used = total - os.freemem();
  let swap = null;
  try {
    const meminfo = fs.readFileSync("/proc/meminfo", "utf8");
    const get = (key) => {
      const match = meminfo.match(new RegExp(`^${key}:\\s+(\\d+)`, "m"));
      return match ? parseInt(match[1], 10) * 1024 : null;
    };
    const swapTotal = get("SwapTotal");
    const swapFree = get("SwapFree");
    if (swapTotal != null && swapTotal > 0) {
      swap = { total: swapTotal, used: swapTotal - (swapFree || 0) };
    }
  } catch {
    /* no /proc/meminfo — swap stays null */
  }
  return { total, used, swap };
}

/* ------------------------------------------------------------------ */
/* Network — per-interface bytes + 1s throughput sample (cached 5s)    */
/* ------------------------------------------------------------------ */

function readNetDev() {
  const raw = fs.readFileSync("/proc/net/dev", "utf8");
  const interfaces = [];
  let rx = 0;
  let tx = 0;
  for (const line of raw.split("\n").slice(2)) {
    const match = line.match(
      /^\s*([^:\s]+):\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/
    );
    if (!match) continue;
    const name = match[1];
    const rxb = parseInt(match[2], 10);
    const txb = parseInt(match[10], 10);
    if (name !== "lo") {
      rx += rxb;
      tx += txb;
    }
    interfaces.push({ name, rxBytes: rxb, txBytes: txb });
  }
  return { rx, tx, interfaces };
}

let netCache = null;

/** Throughput (MB/s) sampled over 1s, cached for 5s. */
async function getNetwork() {
  if (netCache && Date.now() - netCache.at < 5000) return netCache.value;
  try {
    const before = readNetDev();
    await sleep(1000);
    const after = readNetDev();
    // Another caller may have completed the sample while we slept.
    if (netCache && Date.now() - netCache.at < 5000) return netCache.value;
    const download = Number(
      (Math.max(0, after.rx - before.rx) / 1048576).toFixed(2)
    );
    const upload = Number(
      (Math.max(0, after.tx - before.tx) / 1048576).toFixed(2)
    );
    const value = {
      download,
      upload,
      interfaces: after.interfaces.map((iface) => {
        const beforeIface = before.interfaces.find((i) => i.name === iface.name);
        return {
          name: iface.name,
          rxBytes: iface.rxBytes,
          txBytes: iface.txBytes,
          down: beforeIface
            ? Number(
                (Math.max(0, iface.rxBytes - beforeIface.rxBytes) / 1048576).toFixed(2)
              )
            : 0,
          up: beforeIface
            ? Number(
                (Math.max(0, iface.txBytes - beforeIface.txBytes) / 1048576).toFixed(2)
              )
            : 0,
        };
      }),
    };
    netCache = { value, at: Date.now() };
    return value;
  } catch {
    return { download: null, upload: null, interfaces: [] };
  }
}

/* ------------------------------------------------------------------ */
/* Disk I/O — /proc/diskstats rates (cached 5s)                        */
/* ------------------------------------------------------------------ */

function readDiskStats() {
  const raw = fs.readFileSync("/proc/diskstats", "utf8");
  const devices = [];
  for (const line of raw.split("\n")) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 14) continue;
    // major minor name reads reads_merged sectors_read ms_read writes
    // writes_merged sectors_written ms_write io_in_progress ms_io ms_weighted
    const name = parts[2];
    if (name.startsWith("loop") || name.startsWith("ram")) continue;
    devices.push({
      name,
      reads: parseInt(parts[3], 10),
      sectorsRead: parseInt(parts[5], 10),
      writes: parseInt(parts[7], 10),
      sectorsWritten: parseInt(parts[9], 10),
    });
  }
  return devices;
}

let ioCache = null;

/** Disk read/write throughput (bytes/s) sampled over 1s, cached 5s. */
async function getDiskIo() {
  if (ioCache && Date.now() - ioCache.at < 5000) return ioCache.value;
  try {
    const before = readDiskStats();
    await sleep(1000);
    const after = readDiskStats();
    if (ioCache && Date.now() - ioCache.at < 5000) return ioCache.value;
    const elapsed = 1; // one second window
    let readBytes = 0;
    let writeBytes = 0;
    let readOps = 0;
    let writeOps = 0;
    for (const dev of after) {
      const prev = before.find((d) => d.name === dev.name);
      if (!prev) continue;
      readBytes += Math.max(0, dev.sectorsRead - prev.sectorsRead) * 512;
      writeBytes += Math.max(0, dev.sectorsWritten - prev.sectorsWritten) * 512;
      readOps += Math.max(0, dev.reads - prev.reads);
      writeOps += Math.max(0, dev.writes - prev.writes);
    }
    const value = {
      readBps: Math.round(readBytes / elapsed),
      writeBps: Math.round(writeBytes / elapsed),
      readOps,
      writeOps,
    };
    ioCache = { value, at: Date.now() };
    return value;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Temperature — sysfs thermal zones (null when not exposed)           */
/* ------------------------------------------------------------------ */

function getTemperatures() {
  try {
    const zones = fs
      .readdirSync("/sys/class/thermal")
      .filter((name) => name.startsWith("thermal_zone"));
    if (!zones.length) return null;
    return zones
      .map((zone) => {
        try {
          const raw = fs
            .readFileSync(`/sys/class/thermal/${zone}/temp`, "utf8")
            .trim();
          const millidegrees = parseInt(raw, 10);
          if (!Number.isFinite(millidegrees)) return null;
          let type = null;
          try {
            type = fs
              .readFileSync(`/sys/class/thermal/${zone}/type`, "utf8")
              .trim();
          } catch {
            /* no type file */
          }
          return { zone, type, celsius: Math.round(millidegrees / 1000) };
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Processes — top CPU consumers (best-effort, null when unavailable)  */
/* ------------------------------------------------------------------ */

function getTopProcesses() {
  try {
    const out = execSync(
      "ps -eo pid,comm,pcpu,pmem,rss,args --sort=-pcpu 2>/dev/null | head -12",
      { encoding: "utf8", timeout: 5000 }
    );
    return out
      .split("\n")
      .slice(1)
      .filter(Boolean)
      .map((line) => {
        const match = line.match(/^\s*(\d+)\s+(\S+)\s+([\d.]+)\s+([\d.]+)\s+(\d+)\s+(.*)$/);
        if (!match) return null;
        return {
          pid: parseInt(match[1], 10),
          command: match[2],
          cpu: parseFloat(match[3]),
          mem: parseFloat(match[4]),
          rss: parseInt(match[5], 10),
          args: String(match[6] || "").slice(0, 90),
        };
      })
      .filter(Boolean);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Host info + uptime                                                  */
/* ------------------------------------------------------------------ */

function getHostInfo() {
  let model = null;
  try {
    const cpuinfo = fs.readFileSync("/proc/cpuinfo", "utf8");
    const match = cpuinfo.match(/^model name\s*:\s*(.+)$/m);
    model = match ? match[1].trim() : null;
  } catch {
    /* not exposed */
  }
  const uptimeSeconds = os.uptime();
  return {
    hostname: os.hostname(),
    platform: os.platform(),
    os: `${os.type()} ${os.release()}`,
    arch: os.arch(),
    cores: os.cpus().length || 1,
    model,
    uptimeSeconds,
    uptime: formatUptime(uptimeSeconds),
    loadAvg: os.loadavg().map((value) => Number(value.toFixed(2))),
  };
}

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

/* ------------------------------------------------------------------ */
/* Docker overview — Portainer list cached 15s (null when unreachable) */
/* ------------------------------------------------------------------ */

let dockerCache = null;

async function getDockerOverview() {
  if (dockerCache && Date.now() - dockerCache.at < 15000) return dockerCache.value;
  try {
    const containers = await portainer.getContainers();
    const value = {
      total: containers.length,
      running: containers.filter((c) => c.State === "running").length,
      stopped: containers.filter((c) => c.State === "exited").length,
      created: containers.filter((c) => c.State === "created").length,
      restarting: containers.filter((c) => /restarting/i.test(c.Status || "")).length,
      paused: containers.filter((c) => c.State === "paused").length,
      unhealthy: containers.filter((c) => /unhealthy/i.test(c.Status || "")).length,
    };
    dockerCache = { value, at: Date.now() };
    return value;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Aggregate (cached 4s)                                               */
/* ------------------------------------------------------------------ */

let aggregateCache = null;

async function getSystemMetrics() {
  if (aggregateCache && Date.now() - aggregateCache.at < 4000) {
    return aggregateCache.value;
  }
  const memory = getMemory();
  const swap = memory.swap
    ? {
        total: memory.swap.total,
        used: memory.swap.used,
        percent: memory.swap.total
          ? Math.round((memory.swap.used / memory.swap.total) * 100)
          : 0,
      }
    : null;

  const [network, diskIo, docker] = await Promise.all([
    getNetwork(),
    getDiskIo(),
    getDockerOverview(),
  ]);

  const host = getHostInfo();
  const ramPercent = memory.total
    ? Math.round((memory.used / memory.total) * 100)
    : 0;

  const value = {
    generatedAt: new Date().toISOString(),
    cpu: getCpuUsage(),
    ram: ramPercent,
    memory: {
      total: memory.total,
      used: memory.used,
      free: Math.max(0, memory.total - memory.used),
    },
    swap,
    temperature: getTemperatures(),
    network,
    diskIo,
    processes: getTopProcesses(),
    docker: docker,
    host,
  };
  aggregateCache = { value, at: Date.now() };
  return value;
}

// Warm the CPU sample at load so the first API call already has a real delta.
try {
  cpuLast = readCpuTimes();
} catch {
  /* leave cpuLast null */
}

module.exports = {
  getSystemMetrics,
  getCpuUsage,
  getMemory,
  getNetwork,
  getDiskIo,
  getTemperatures,
  getTopProcesses,
  getHostInfo,
  getDockerOverview,
};
