import "./Docker.css";

import { useCallback, useEffect, useState } from "react";
import {
  Boxes,
  ExternalLink,
  Play,
  RefreshCw,
  RotateCw,
  Square,
} from "lucide-react";

import {
  getContainers,
  restartContainer,
  startContainer,
  stopContainer,
} from "../services/dockerService";
import { success, error as toastError } from "../services/toastService";
import { services } from "../data/services";

import DockerDetails from "../components/dashboard/Docker/DockerDetails";

function RowSkeleton() {
  return (
    <div className="docker-row">
      <div className="skeleton sk-title" />
      <div className="skeleton sk-sub" />
      <div className="skeleton sk-line" />
    </div>
  );
}

export default function DockerPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [selected, setSelected] = useState(null);

  const portainer = services.find((service) => service.id === "docker");

  const load = useCallback(async () => {
    try {
      const result = await getContainers();
      setData(result);
      setError(null);
    } catch (err) {
      console.error("[REX OS] docker load failed:", err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  async function runAction(action, container) {
    setBusyId(container.id);

    try {
      if (action === "start") await startContainer(container.id);
      if (action === "stop") await stopContainer(container.id);
      if (action === "restart") await restartContainer(container.id);

      success(
        `${container.name} ${
          action === "start"
            ? "started"
            : action === "stop"
            ? "stopped"
            : "restarted"
        }`,
      );
      await load();
    } catch (err) {
      console.error(err);
      toastError("Action failed");
    } finally {
      setBusyId(null);
    }
  }

  const containers = data?.containers || [];
  const running = data?.running ?? 0;
  const stopped = data?.stopped ?? 0;

  return (
    <div className="page">
      <div className="page-head fade-up">
        <h1>Docker</h1>
        <p>Containers & Services — managed through Portainer</p>
      </div>

      <div className="docker-summary fade-up d-1">
        <div className="summary-chip">
          <div
            className="chip-icon"
            style={{
              background: "#3b82f6",
              boxShadow: "0 10px 24px rgba(59,130,246,.35)",
            }}
          >
            <Boxes size={22} />
          </div>
          <div>
            <strong>{containers.length}</strong>
            <span>Total containers</span>
          </div>
        </div>

        <div className="summary-chip">
          <div
            className="chip-icon"
            style={{
              background: "#22c55e",
              boxShadow: "0 10px 24px rgba(34,197,94,.35)",
            }}
          >
            <Play size={22} />
          </div>
          <div>
            <strong>{running}</strong>
            <span>Running</span>
          </div>
        </div>

        <div className="summary-chip">
          <div
            className="chip-icon"
            style={{
              background: "#f97316",
              boxShadow: "0 10px 24px rgba(249,115,22,.35)",
            }}
          >
            <Square size={22} />
          </div>
          <div>
            <strong>{stopped}</strong>
            <span>Stopped</span>
          </div>
        </div>
      </div>

      <section className="docker-table fade-up d-2">
        <div className="docker-table-header">
          <h2>Containers</h2>

          <div style={{ display: "flex", gap: 10 }}>
            {portainer && (
              <a
                className="widget-link"
                href={portainer.url}
                target="_blank"
                rel="noreferrer"
              >
                Portainer
                <ExternalLink size={14} />
              </a>
            )}

            <button
              type="button"
              className="refresh-btn"
              onClick={load}
              disabled={loading}
            >
              <RefreshCw size={15} className={loading ? "spin" : ""} />
              Refresh
            </button>
          </div>
        </div>

        {!loading && !error && containers.length > 0 && (
          <div className="docker-table-colhead" aria-hidden="true">
            <span>Container</span>
            <span>State</span>
            <span>Status</span>
            <span />
          </div>
        )}

        {loading && !data ? (
          <div aria-busy="true">
            <RowSkeleton />
            <RowSkeleton />
            <RowSkeleton />
            <RowSkeleton />
          </div>
        ) : error ? (
          <div className="error-card">
            <div className="error-icon">
              <Boxes size={22} />
            </div>

            <div className="error-body">
              <h3>Portainer is unreachable</h3>
              <p>
                Could not reach Portainer. Check that it is running and the API
                token is configured.
              </p>
            </div>

            <button type="button" className="retry-btn" onClick={load}>
              <RefreshCw size={16} />
              Retry
            </button>
          </div>
        ) : containers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <Boxes size={24} />
            </div>
            <h3>No containers found</h3>
            <p>Start containers on your NAS and they will appear here.</p>
          </div>
        ) : (
          <div>
            {containers.map((container, index) => (
              <div
                key={container.id}
                className={`docker-row fade-up d-${Math.min(index + 1, 8)}`}
                onClick={() => setSelected(container)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelected(container);
                  }
                }}
              >
                <div className="docker-row-name">
                  <div className="row-icon">
                    <Boxes size={18} />
                  </div>
                  <div>
                    <h4>{container.name}</h4>
                    <span title={container.image}>{container.image}</span>
                  </div>
                </div>

                <span
                  className={`badge ${
                    container.state === "running" ? "success" : "danger"
                  }`}
                >
                  {container.state}
                </span>

                <div className="docker-row-status">{container.status}</div>

                <div
                  className="docker-row-actions"
                  onClick={(event) => event.stopPropagation()}
                >
                  {container.state !== "running" && (
                    <button
                      type="button"
                      className="row-action"
                      aria-label={`Start ${container.name}`}
                      title="Start"
                      disabled={busyId === container.id}
                      onClick={() => runAction("start", container)}
                    >
                      <Play size={16} />
                    </button>
                  )}

                  {container.state === "running" && (
                    <button
                      type="button"
                      className="row-action"
                      aria-label={`Stop ${container.name}`}
                      title="Stop"
                      disabled={busyId === container.id}
                      onClick={() => runAction("stop", container)}
                    >
                      <Square size={15} />
                    </button>
                  )}

                  <button
                    type="button"
                    className="row-action"
                    aria-label={`Restart ${container.name}`}
                    title="Restart"
                    disabled={busyId === container.id}
                    onClick={() => runAction("restart", container)}
                  >
                    <RotateCw size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <DockerDetails container={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
