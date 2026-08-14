import "./Activity.css";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity as ActivityIcon,
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Download,
  HardDrive,
  Info,
  RefreshCw,
  Search,
  Trash2,
  Workflow,
  XCircle,
} from "lucide-react";

import { getActivity, clearActivity } from "../api/activity";

const SEVERITY_META = {
  info: { label: "INFO", icon: Info, cls: "info" },
  success: { label: "SUCCESS", icon: CheckCircle2, cls: "success" },
  warning: { label: "WARNING", icon: AlertTriangle, cls: "warning" },
  error: { label: "ERROR", icon: XCircle, cls: "error" },
  critical: { label: "CRITICAL", icon: XCircle, cls: "critical" },
};

const TYPE_META = {
  docker: { icon: Boxes, label: "Docker" },
  recovery: { icon: RefreshCw, label: "Recovery" },
  pipeline: { icon: Workflow, label: "Pipeline" },
  downloads: { icon: Download, label: "Downloads" },
  storage: { icon: HardDrive, label: "Storage" },
  diagnostics: { icon: ActivityIcon, label: "Diagnostics" },
  event: { icon: Info, label: "Event" },
};

function relativeTime(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 45000) return "just now";
  if (diff < 3600000) return `${Math.max(1, Math.floor(diff / 60000))}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function fullTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Activity() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [severity, setSeverity] = useState("");
  const [service, setService] = useState("");
  const [range, setRange] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    try {
      const since =
        range === "24h"
          ? new Date(Date.now() - 86400000).toISOString()
          : range === "7d"
          ? new Date(Date.now() - 7 * 86400000).toISOString()
          : range === "30d"
          ? new Date(Date.now() - 30 * 86400000).toISOString()
          : "";
      const result = await getActivity({ severity, service, search, since });
      setData(result);
      setError(null);
    } catch (err) {
      console.error("[REX OS] activity load failed:", err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [severity, service, range, search]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  // Light polling while visible (30s) so an open log stays current.
  useEffect(() => {
    const timer = setInterval(() => {
      if (!document.hidden) load();
    }, 30000);
    return () => clearInterval(timer);
  }, [load]);

  const serviceOptions = useMemo(() => {
    if (!data?.entries) return [];
    return [...new Set(data.entries.map((entry) => entry.service).filter(Boolean))].sort();
  }, [data]);

  async function handleClear() {
    if (!window.confirm("Clear the entire activity log? This cannot be undone.")) return;
    await clearActivity();
    load();
  }

  return (
    <div className="page">
      <div className="page-head fade-up">
        <h1>Activity</h1>
        <p>Everything that happens on your NAS — restarts, recovery, downloads, diagnostics</p>
      </div>

      {/* Filters */}
      <div className="activity-filters fade-up d-1">
        <div className="activity-search">
          <Search size={16} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search activity…"
            aria-label="Search activity"
          />
        </div>

        <select value={severity} onChange={(event) => setSeverity(event.target.value)} aria-label="Filter by severity">
          <option value="">All severities</option>
          <option value="info">INFO</option>
          <option value="success">SUCCESS</option>
          <option value="warning">WARNING</option>
          <option value="error">ERROR</option>
          <option value="critical">CRITICAL</option>
        </select>

        <select value={service} onChange={(event) => setService(event.target.value)} aria-label="Filter by service">
          <option value="">All services</option>
          {serviceOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <select value={range} onChange={(event) => setRange(event.target.value)} aria-label="Filter by time">
          <option value="">All time</option>
          <option value="24h">Last 24h</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
        </select>

        <button type="button" className="refresh-btn" onClick={load} disabled={loading}>
          <RefreshCw size={15} className={loading ? "spin" : ""} />
          Refresh
        </button>

        <button type="button" className="clear-btn" onClick={handleClear} title="Clear activity log">
          <Trash2 size={15} />
          Clear
        </button>
      </div>

      {loading && !data ? (
        <div aria-busy="true" className="activity-list">
          <div className="skeleton sk-line" />
          <div className="skeleton sk-line" />
          <div className="skeleton sk-line" />
          <div className="skeleton sk-line" />
        </div>
      ) : error ? (
        <div className="error-card">
          <div className="error-icon">
            <AlertTriangle size={20} />
          </div>
          <div className="error-body">
            <h3>Activity log unavailable</h3>
            <p>Could not reach the REX backend.</p>
          </div>
          <button type="button" className="retry-btn" onClick={load}>
            <RefreshCw size={16} />
            Retry
          </button>
        </div>
      ) : data?.entries?.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <ActivityIcon size={24} />
          </div>
          <h3>No activity yet</h3>
          <p>Actions, restarts and recovery events will appear here as they happen.</p>
        </div>
      ) : (
        <>
          <p className="activity-count fade-up d-2">{data.total} event{data.total === 1 ? "" : "s"}</p>

          <div className="activity-list fade-up d-2">
            {data.entries.map((entry) => {
              const sev = SEVERITY_META[entry.severity] || SEVERITY_META.info;
              const type = TYPE_META[entry.type] || TYPE_META.event;
              const TypeIcon = type.icon;
              const SevIcon = sev.icon;
              return (
                <div key={entry.id} className="activity-item">
                  <div className={`activity-type-icon ${sev.cls}`}>
                    <TypeIcon size={16} />
                  </div>

                  <div className="activity-body">
                    <div className="activity-title">
                      {entry.message || entry.action}
                    </div>
                    <div className="activity-meta">
                      <span className={`activity-sev ${sev.cls}`}>
                        <SevIcon size={11} />
                        {sev.label}
                      </span>
                      <span>{type.label}</span>
                      {entry.service && <span>· {entry.service}</span>}
                      {entry.action && <span>· {entry.action}</span>}
                    </div>
                  </div>

                  <div className="activity-time" title={fullTime(entry.time)}>
                    {relativeTime(entry.time)}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
