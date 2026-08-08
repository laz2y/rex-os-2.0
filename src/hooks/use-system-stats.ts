import { useCallback, useEffect, useState } from "react";

export type Volume = {
  name: string;
  mount: string;
  totalGb: number;
  usedGb: number;
};

export type SystemStats = {
  cpu: { usage: number; tempC: number; history: number[] };
  memory: { usedGb: number; totalGb: number; percent: number; history: number[] };
  storage: { usedTb: number; totalTb: number; percent: number; volumes: Volume[] };
  network: { rxMbps: number; txMbps: number; rxHistory: number[]; txHistory: number[] };
  host: {
    hostname: string;
    model: string;
    os: string;
    kernel: string;
    cores: number;
    ramGb: number;
    ip: string;
  };
  uptimeSec: number;
};

const TICK_MS = 2000;
const HISTORY_LEN = 48;
const LOADING_MS = 900;

const HOST = {
  hostname: "rexos-node",
  model: "RexNode Pro",
  os: "Ubuntu Server 24.04 LTS",
  kernel: "6.8.0-45-generic",
  cores: 8,
  ramGb: 32,
  ip: "192.168.1.42",
};

const VOLUMES: Volume[] = [
  { name: "System", mount: "/", totalGb: 120, usedGb: 78 },
  { name: "Media", mount: "/mnt/media", totalGb: 4096, usedGb: 3174 },
  { name: "Backup", mount: "/mnt/backup", totalGb: 2048, usedGb: 1407 },
  { name: "Docker", mount: "/mnt/docker", totalGb: 500, usedGb: 211 },
];

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

function walk(value: number, step: number, min: number, max: number) {
  return clamp(value + (Math.random() - 0.5) * 2 * step, min, max);
}

function pushHistory(arr: number[], value: number, max = HISTORY_LEN) {
  const next = arr.length >= max ? arr.slice(1) : [...arr];
  next.push(value);
  return next;
}

function initialState(): SystemStats {
  return {
    cpu: { usage: 14, tempC: 47, history: [14] },
    memory: { usedGb: 9.6, totalGb: HOST.ramGb, percent: 30, history: [30] },
    storage: {
      usedTb: (78 + 3174 + 1407 + 211) / 1024,
      totalTb: (120 + 4096 + 2048 + 500) / 1024,
      percent: 0,
      volumes: VOLUMES,
    },
    network: { rxMbps: 0.8, txMbps: 0.3, rxHistory: [0.8], txHistory: [0.3] },
    host: HOST,
    uptimeSec: 31 * 86400 + 4 * 3600 + 12 * 60,
  };
}

// Module-scope initial snapshot (evaluated once, before any render).
const INITIAL_STATS: SystemStats = initialState();

/** Pure advance: returns the next telemetry snapshot without mutating state. */
function advance(
  s: SystemStats,
  spikes: { cpu: number; net: number; tick: number },
): SystemStats {
  spikes.tick += 1;

  if (spikes.cpu > 0) spikes.cpu -= 1;
  else if (Math.random() < 0.04) spikes.cpu = 4;
  const cpuTarget = 14 + spikes.cpu * 5;
  const cpuUsage = clamp(cpuTarget + (Math.random() - 0.5) * 5, 3, 92);
  const tempC = clamp(43 + cpuUsage * 0.35 + (Math.random() - 0.5) * 2, 38, 72);

  const mem = walk(s.memory.usedGb, 0.4, 7.5, 17);
  const memPercent = (mem / HOST.ramGb) * 100;

  if (spikes.net > 0) spikes.net -= 1;
  else if (Math.random() < 0.06) spikes.net = 6;
  const burst = spikes.net > 0 ? 24 : 0;
  const rx = clamp(walk(s.network.rxMbps, 0.6, 0.2, 90) + burst, 0.2, 96);
  const tx = clamp(walk(s.network.txMbps, 0.3, 0.1, 40) + burst * 0.35, 0.1, 44);

  const totalUsed = s.storage.volumes.reduce((a, v) => a + v.usedGb, 0);
  const totalCap = s.storage.volumes.reduce((a, v) => a + v.totalGb, 0);

  return {
    cpu: {
      usage: cpuUsage,
      tempC,
      history: pushHistory(s.cpu.history, cpuUsage),
    },
    memory: {
      usedGb: mem,
      totalGb: HOST.ramGb,
      percent: memPercent,
      history: pushHistory(s.memory.history, memPercent),
    },
    storage: {
      usedTb: totalUsed / 1024,
      totalTb: totalCap / 1024,
      percent: (totalUsed / totalCap) * 100,
      volumes: s.storage.volumes,
    },
    network: {
      rxMbps: rx,
      txMbps: tx,
      rxHistory: pushHistory(s.network.rxHistory, rx),
      txHistory: pushHistory(s.network.txHistory, tx),
    },
    host: HOST,
    uptimeSec: s.uptimeSec + TICK_MS / 1000,
  };
}

/**
 * Simulated live telemetry for the REX OS console (CPU / RAM / storage /
 * network / host). Real deployments can swap `advance` for a systemd /
 * Netdata / SNMP endpoint — the shape consumed by the UI stays the same.
 * Includes a brief loading phase so skeleton loaders are exercised.
 */
export function useSystemStats() {
  const [stats, setStats] = useState<SystemStats>(INITIAL_STATS);
  const [phase, setPhase] = useState<"loading" | "live">("loading");

  useEffect(() => {
    if (phase !== "loading") return;
    const timer = setTimeout(() => setPhase("live"), LOADING_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    const spikes = { cpu: 0, net: 0, tick: 0 };
    const id = setInterval(() => {
      setStats((s) => advance(s, spikes));
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);

  const retry = useCallback(() => {
    setStats(INITIAL_STATS);
    setPhase("loading");
  }, []);

  return { stats, phase, retry };
}
