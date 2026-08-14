import "./Docker.css";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Boxes,
  ExternalLink,
  Play,
  RefreshCw,
  RotateCw,
  Search,
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

const FILTERS = [
  { id: "all", label: "All" },
  { id: "running", label: "Running" },
  { id: "stopped", label: "Stopped" },
  { id: "restarting", label: "Restarting" },
  { id: "unhealthy", label: "Unhealthy" },
];

const SORTS = [
  { id: "name", label: "Name" },
  { id: "state", label: "State" },
  { id: "created", label: "Created" },
  { id: "status", label: "Status" },
];

function matchesFilter(container, filter) {
  switch (filter) {
    case "running":
      return container.state === "running";
    case "stopped":
      return container.state !== "running";
    case "restarting":
      return /restarting/i.test(container.status || "");
    case "unhealthy":
      return /unhealthy/i.test(container.status || "");
    default:
      return true;
  }
}

function formatCreated(ts) {
  if (!ts) return "—";
  const seconds = Math.floor(Date.now() / 1000) - ts;
  if (seconds < 0) return "just now";
  if (seconds < 3600) return `${Math.max(1, Math.floor(seconds / 60))}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

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

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("name");

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
  const restarting = containers.filter((c) => /restarting/i.test(c.status || "")).length;
  const unhealthy = containers.filter((c) => /unhealthy/i.test(c.status || "")).length;

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    let list = containers.filter((container) => {
      if (!matchesFilter(container, filter)) return false;
      if (!term) return true;
      const name = (container.name || "").toLowerCase();
      const image = (container.image || "").toLowerCase();
      return name.includes(term) || image.includes(term);
    });

    list = [...list].sort((a, b) => {
      switch (sort) {
        case "state": {
          const order = { running: 0, paused: 1, restarting: 2, created: 3, exited: 4 };
          return (order[a.state] ?? 9) - (order[b.state] ?? 9);
        }
        case "created":
          return (b.created || 0) - (a.created || 0);
        case "status":
          return String(a.status).localeCompare(String(b.status));
        case "name":
        default:
          return String(a.name).localeCompare(String(b.name));
      }
    });

    return list;
  }, [containers, filter, query, sort]);

  const summaryChips = [
    { label: "Total containers", value: containers.length, icon: Boxes, color: "#3b82f6" },
    { label: "Running", value: running, icon: Play, color: "#22c55e" },
    { label: "Stopped", value: stopped, icon: Square, color: "#f97316" },
    { label: "Restarting", value: restarting, icon: RotateCw, color: restarting ? "#ef4444" : "#64748b" },
    { label: "Unhealthy", value: unhealthy, icon: Boxes, color: unhealthy ? "#f59e0b" : "#64748b" },
  ];

  return (
    <div className="page">
      <div className="page-head fade-up">
        <h1>Docker</h1>
        <p>Containers & Services — managed through Portainer</p>
      </div>

      <div className="docker-summary fade-up d-1">
        {summaryChips.map((chip) => (
          <div className="summary-chip" key={chip.label}>
            <div
              className="chip-icon"
              style={{ background: chip.color, boxShadow: `0 10px 24px ${chip.color}55` }}
            >
              <chip.icon size={22} />
            </div>
            <div>
              <strong>{chip.value}</strong>
              <span>{chip.label}</span>
            </div>
          </div>
        ))}
      </div>

      <section className="docker-table fade-up d-2">
        <div className="docker-table-header">
          <h2>Containers</h2>

          <div className="docker-toolbar">
            <div className="docker-search">
              <Search size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search containers or images…"
                aria-label="Search containers"
              />
            </div>

            <select
              className="docker-sort"
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              aria-label="Sort containers"
            >
              {SORTS.map((option) => (
                <option key={option.id} value={option.id}>
                  Sort: {option.label}
                </option>
              ))}
            </select>

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

        {/* Status filters */}
        {!loading && !error && containers.length > 0 && (
          <div className="docker-filters" role="tablist" aria-label="Filter containers">
            {FILTERS.map((item) => {
              const count =
                item.id === "all"
                  ? containers.length
                  : containers.filter((c) => matchesFilter(c, item.id)).length;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === item.id}
                  className={`docker-filter ${filter === item.id ? "active" : ""}`}
                  onClick={() => setFilter(item.id)}
                >
                  {item.label}
                  <span className="docker-filter-count">{count}</span>
                </button>
              );
            })}
          </div>
        )}

        {!loading && !error && visible.length > 0 && (
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
        ) : visible.length === 0 ? (
          <div className="empty-state compact">
            <div className="empty-icon">
              <Search size={24} />
            </div>
            <h3>No matching containers</h3>
            <p>No containers match this search or filter. Try another term.</p>
          </div>
        ) : (
          <div>
            {visible.map((container, index) => (
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
                    <span className="docker-row-meta">
                      {container.shortId && <em title={container.id}>{container.shortId}</em>}
                      {container.health && (
                        <em className={`health ${container.health}`}>{container.health}</em>
                      )}
                      {container.created && <em>created {formatCreated(container.created)}</em>}
                    </span>
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

      <DockerDetails
        container={selected}
        onClose={() => setSelected(null)}
        onChanged={load}
      />
    </div>
  );
}
