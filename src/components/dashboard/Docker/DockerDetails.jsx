import "./DockerDetails.css";

import {
  X,
  Server,
  Play,
  Square,
  RotateCw,
  FileText,
  Cpu,
  MemoryStick,
  Network,
  RefreshCw,
  HardDrive,
  CalendarDays,
  Activity,
} from "lucide-react";

import { useEffect, useState } from "react";

import {
  restartContainer,
  startContainer,
  stopContainer,
  getContainerLogs,
  getContainerStats,
  getContainerInspect,
} from "../../../services/dockerService";

import DockerLogs from "./DockerLogs";

import {
  success,
  error,
} from "../../../services/toastService";

function formatBytes(value) {
  if (value == null || !Number.isFinite(value)) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size >= 100 || unit === 0 ? Math.round(size) : size.toFixed(1)} ${units[unit]}`;
}

function formatDate(iso) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DockerDetails({ container, onClose, onChanged }) {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [inspect, setInspect] = useState(null);
  const [logs, setLogs] = useState(null);

  // Load live stats + curated inspect whenever a container is opened.
  useEffect(() => {
    let active = true;

    if (!container) {
      setStats(null);
      setInspect(null);
      return undefined;
    }

    setStats(null);
    setInspect(null);

    getContainerStats(container.id)
      .then((data) => {
        if (active) setStats(data);
      })
      .catch(() => {
        /* stats unavailable (e.g. stopped container) — details still work */
      });

    getContainerInspect(container.id)
      .then((data) => {
        if (active) setInspect(data);
      })
      .catch(() => {
        /* inspect unavailable */
      });

    return () => {
      active = false;
    };
  }, [container?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!container) return null;

  async function runAction(action) {
    setLoading(true);

    try {
      if (action === "start") await startContainer(container.id);
      if (action === "stop") await stopContainer(container.id);
      if (action === "restart") await restartContainer(container.id);

      success(
        `${container.name} ${
          action === "start" ? "started" : action === "stop" ? "stopped" : "restarted"
        }`,
      );
      onClose();
      if (typeof onChanged === "function") onChanged();
    } catch (err) {
      console.error(err);
      error("Action failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogs() {
    setLoading(true);

    try {
      const data = await getContainerLogs(container.id);
      setLogs(data);
    } catch (err) {
      console.error(err);
      error("Failed to load logs");
    } finally {
      setLoading(false);
    }
  }

  const ports = Array.isArray(container.ports) && container.ports.length
    ? container.ports
    : (inspect?.ports && typeof inspect.ports === "object"
        ? Object.entries(inspect.ports).map(([key, bindings]) => ({
            privatePort: key.split("/")[0],
            publicPort: bindings?.[0]?.HostPort || null,
          }))
        : []);

  const state = inspect?.state || {};
  const health = state.health || null;

  return (
    <>
      <div
        className="docker-overlay"
        onClick={onClose}
      >
        <div
          className="docker-details"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="close-btn"
            onClick={onClose}
          >
            <X size={22} />
          </button>

          <div className="details-content">
            <div className="details-header">
              <div className="details-icon">
                <Server size={30} />
              </div>

              <div>
                <h2>{container.name}</h2>
                <p>{container.image}</p>
                {inspect?.shortId && <p className="details-id">{inspect.shortId}</p>}
              </div>
            </div>

            <div className="details-grid">
              <div>
                <span>Status</span>
                <strong>{container.state}</strong>
              </div>

              <div>
                <span>Uptime</span>
                <strong>{container.status}</strong>
              </div>

              {inspect?.restartCount != null && (
                <div>
                  <span>Restart count</span>
                  <strong>{inspect.restartCount}</strong>
                </div>
              )}

              {inspect?.restartPolicy && (
                <div>
                  <span>Restart policy</span>
                  <strong>{inspect.restartPolicy}</strong>
                </div>
              )}

              {health && (
                <div>
                  <span>Health</span>
                  <strong className={`health-text ${health.status}`}>{health.status}</strong>
                </div>
              )}

              {inspect?.created && (
                <div>
                  <span>
                    <CalendarDays size={13} /> Created
                  </span>
                  <strong>{formatDate(inspect.created)}</strong>
                </div>
              )}
            </div>

            {/* Live resource stats */}
            {stats && (
              <div className="details-stats">
                <div className="details-stats-head">
                  <span>
                    <Activity size={13} /> Live usage
                  </span>
                  <RefreshCw size={12} className="spin" />
                </div>
                <div className="details-stat-row">
                  <div>
                    <Cpu size={16} />
                    <span>CPU</span>
                    <strong>{stats.cpuPercent != null ? `${stats.cpuPercent}%` : "—"}</strong>
                  </div>
                  <div>
                    <MemoryStick size={16} />
                    <span>Memory</span>
                    <strong>
                      {stats.memory?.percent != null
                        ? `${stats.memory.percent}%`
                        : "—"}
                      <em>
                        {formatBytes(stats.memory?.usage)} / {formatBytes(stats.memory?.limit)}
                      </em>
                    </strong>
                  </div>
                  <div>
                    <Network size={16} />
                    <span>Network</span>
                    <strong>
                      {formatBytes(stats.network?.rxBytes)}
                      <em>rx</em> · {formatBytes(stats.network?.txBytes)}
                      <em>tx</em>
                    </strong>
                  </div>
                  <div>
                    <HardDrive size={16} />
                    <span>Block I/O</span>
                    <strong>
                      {formatBytes(stats.blockIo?.readBytes)}
                      <em>r</em> / {formatBytes(stats.blockIo?.writeBytes)}
                      <em>w</em>
                    </strong>
                  </div>
                </div>
                {stats.pids != null && (
                  <p className="details-stats-pids">{stats.pids} processes inside the container</p>
                )}
              </div>
            )}

            {/* Ports */}
            {ports.length > 0 && (
              <div className="details-ports">
                <span>Ports</span>
                <div>
                  {ports.map((port, index) => (
                    <em key={`${port.publicPort}-${port.privatePort}-${index}`}>
                      {port.publicPort ? `${port.publicPort} → ` : ""}
                      {port.privatePort}
                      {port.type ? `/${port.type}` : ""}
                    </em>
                  ))}
                </div>
              </div>
            )}

            {/* Mounts */}
            {inspect?.mounts?.length > 0 && (
              <div className="details-mounts">
                <span>Mounts</span>
                {inspect.mounts.map((mount, index) => (
                  <div key={index}>
                    <em title={mount.source}>{mount.source || "—"}</em>
                    <span>→</span>
                    <em title={mount.destination}>{mount.destination}</em>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="details-actions">
            <button disabled={loading} onClick={() => runAction("start")}>
              <Play size={18} />
              {loading ? "Working..." : "Start"}
            </button>

            <button disabled={loading} onClick={() => runAction("stop")}>
              <Square size={18} />
              {loading ? "Working..." : "Stop"}
            </button>

            <button disabled={loading} onClick={() => runAction("restart")}>
              <RotateCw size={18} />
              {loading ? "Working..." : "Restart"}
            </button>

            <button disabled={loading} onClick={handleLogs}>
              <FileText size={18} />
              Logs
            </button>
          </div>
        </div>
      </div>

      <DockerLogs
        logs={logs}
        container={container}
        onClose={() => setLogs(null)}
      />
    </>
  );
}
