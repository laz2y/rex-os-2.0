const portainer = require("./portainerService");

/**
 * Docker Manager 2.0 — richer container data on top of the existing
 * Portainer abstraction. Every list/action still flows through
 * portainerService (no second Docker connection system), so the Phase 1
 * Pipeline restart and Recovery features keep using the same infrastructure.
 *
 * Sensitive data policy: container inspect responses NEVER include
 * Config.Env (environment variables can hold secrets). Only curated fields
 * are returned.
 */

function shortId(id) {
  return id ? String(id).slice(0, 12) : null;
}

function healthFromStatus(status) {
  if (!status) return null;
  const match = String(status).match(/\((healthy|unhealthy)\)/);
  return match ? match[1] : null;
}

/** Enriched container list (additive fields — legacy shape preserved). */
async function getContainers() {
  const list = await portainer.getContainers();
  return list.map((container) => {
    const names = (container.Names || []).map((name) =>
      String(name).replace(/^\//, "")
    );
    const ports = (container.Ports || []).map((entry) => ({
      ip: entry.IP || null,
      publicPort: entry.PublicPort || null,
      privatePort: entry.PrivatePort || null,
      type: entry.Type || null,
    }));
    return {
      id: container.Id,
      shortId: shortId(container.Id),
      name: names[0] || container.Id,
      names,
      image: container.Image || "",
      state: container.State || "unknown",
      status: container.Status || "",
      health: healthFromStatus(container.Status),
      created: container.Created || null,
      ports,
    };
  });
}

/** Live per-container resource stats (CPU %, memory, network, block I/O). */
async function getContainerStats(id) {
  const { data } = await portainer.getContainerStats(id);

  const cpuPercent = (() => {
    const cur = data?.cpu_stats?.cpu_usage;
    const prev = data?.precpu_stats?.cpu_usage;
    const systemCur = data?.cpu_stats?.system_cpu_usage;
    const systemPrev = data?.precpu_stats?.system_cpu_usage;
    if (!cur || !prev || !systemCur || !systemPrev) return null;
    const cpuDelta = (cur.total_usage || 0) - (prev.total_usage || 0);
    const systemDelta = systemCur - systemPrev;
    const online = data?.cpu_stats?.online_cpus || 1;
    if (systemDelta <= 0 || cpuDelta <= 0) return 0;
    return Math.max(0, Math.min(100, (cpuDelta / systemDelta) * online * 100));
  })();

  const memStats = data?.memory_stats;
  const memUsage = memStats?.usage || 0;
  const memLimit = memStats?.limit || 0;
  const memPercent = memLimit ? (memUsage / memLimit) * 100 : null;

  let netRx = 0;
  let netTx = 0;
  for (const iface of Object.values(data?.networks || {})) {
    netRx += iface?.rx_bytes || 0;
    netTx += iface?.tx_bytes || 0;
  }

  let blkRead = 0;
  let blkWrite = 0;
  for (const entry of data?.blkio_stats?.io_service_bytes_recursive || []) {
    if (entry.op === "Read") blkRead += entry.value || 0;
    if (entry.op === "Write") blkWrite += entry.value || 0;
  }

  return {
    cpuPercent: cpuPercent == null ? null : Number(cpuPercent.toFixed(1)),
    memory: {
      usage: memUsage,
      limit: memLimit,
      percent: memPercent == null ? null : Number(memPercent.toFixed(1)),
    },
    network: { rxBytes: netRx, txBytes: netTx },
    blockIo: { readBytes: blkRead, writeBytes: blkWrite },
    pids: data?.pids_stats?.current ?? null,
  };
}

/** Curated container inspect — never includes Config.Env. */
async function getContainerInspect(id) {
  const { data } = await portainer.getContainerInspect(id);

  const state = data?.State || {};
  const health = state.Health;
  const mounts = (data?.Mounts || []).map((mount) => ({
    type: mount.Type || null,
    source: mount.Source || null,
    destination: mount.Destination || null,
    mode: mount.Mode || null,
    rw: Boolean(mount.RW),
  }));

  const ports = data?.NetworkSettings?.Ports || {};

  return {
    id: data?.Id || id,
    shortId: shortId(data?.Id || id),
    name: String(data?.Name || "").replace(/^\//, "") || null,
    image: data?.Config?.Image || null,
    cmd: data?.Config?.Cmd || null,
    entrypoint: data?.Config?.Entrypoint || null,
    created: data?.Created || null,
    restartCount: data?.RestartCount ?? null,
    restartPolicy: data?.HostConfig?.RestartPolicy?.Name || null,
    networkMode: data?.HostConfig?.NetworkMode || null,
    state: {
      status: state.Status || null,
      running: Boolean(state.Running),
      paused: Boolean(state.Paused),
      restarting: Boolean(state.Restarting),
      exitCode: state.ExitCode ?? null,
      error: state.Error || null,
      startedAt: state.StartedAt || null,
      finishedAt: state.FinishedAt || null,
      health: health
        ? {
            status: health.Status || null,
            failingStreak: health.FailingStreak ?? null,
          }
        : null,
    },
    ports,
    mounts,
  };
}

module.exports = {
  getContainers,
  getContainerStats,
  getContainerInspect,
};
