import "./Notifications.css";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  CheckCircle2,
  Info,
  RefreshCw,
  Trash2,
  X,
  XCircle,
} from "lucide-react";

import {
  getNotifications,
  markNotificationRead,
  removeNotification,
  clearNotifications,
} from "../api/notifications";

const SEVERITY_META = {
  info: { label: "INFO", icon: Info, cls: "info" },
  success: { label: "SUCCESS", icon: CheckCircle2, cls: "success" },
  warning: { label: "WARNING", icon: AlertTriangle, cls: "warning" },
  error: { label: "ERROR", icon: XCircle, cls: "error" },
  critical: { label: "CRITICAL", icon: XCircle, cls: "critical" },
};

function relativeTime(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 45000) return "just now";
  if (diff < 3600000) return `${Math.max(1, Math.floor(diff / 60000))}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function Notifications() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [severity, setSeverity] = useState("");

  const load = useCallback(async () => {
    try {
      const result = await getNotifications({ severity });
      setData(result);
      setError(null);
    } catch (err) {
      console.error("[REX OS] notifications load failed:", err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [severity]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  // Poll while visible so the badge and list stay current.
  useEffect(() => {
    const timer = setInterval(() => {
      if (!document.hidden) load();
    }, 30000);
    return () => clearInterval(timer);
  }, [load]);

  async function handleReadOne(id) {
    await markNotificationRead(id);
    load();
  }

  async function handleReadAll() {
    await markNotificationRead(null);
    load();
  }

  async function handleRemove(id) {
    await removeNotification(id);
    load();
  }

  async function handleClear() {
    if (!window.confirm("Clear all notifications?")) return;
    await clearNotifications();
    load();
  }

  const entries = data?.entries || [];

  return (
    <div className="page">
      <div className="page-head fade-up">
        <h1>Notifications</h1>
        <p>Alerts from services, recovery, storage and the pipeline</p>
      </div>

      <div className="notif-toolbar fade-up d-1">
        <div className="notif-toolbar-info">
          <Bell size={16} />
          {data && (
            <span>
              {data.unread > 0 ? (
                <strong className="unread-count">{data.unread} unread</strong>
              ) : (
                "All caught up"
              )}{" "}
              · {data.total} total
            </span>
          )}
        </div>

        <div className="notif-toolbar-actions">
          <select
            value={severity}
            onChange={(event) => setSeverity(event.target.value)}
            aria-label="Filter by severity"
          >
            <option value="">All severities</option>
            <option value="info">INFO</option>
            <option value="success">SUCCESS</option>
            <option value="warning">WARNING</option>
            <option value="error">ERROR</option>
            <option value="critical">CRITICAL</option>
          </select>

          <button type="button" className="refresh-btn" onClick={load} disabled={loading}>
            <RefreshCw size={15} className={loading ? "spin" : ""} />
            Refresh
          </button>

          <button
            type="button"
            className="soft-btn"
            onClick={handleReadAll}
            disabled={!data?.unread}
          >
            <CheckCheck size={15} />
            Mark all read
          </button>

          <button type="button" className="clear-btn" onClick={handleClear} disabled={!data?.total}>
            <Trash2 size={15} />
            Clear
          </button>
        </div>
      </div>

      {loading && !data ? (
        <div aria-busy="true" className="notif-list">
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
            <h3>Notifications unavailable</h3>
            <p>Could not reach the REX backend.</p>
          </div>
          <button type="button" className="retry-btn" onClick={load}>
            <RefreshCw size={16} />
            Retry
          </button>
        </div>
      ) : entries.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <Bell size={24} />
          </div>
          <h3>No notifications</h3>
          <p>Service alerts, storage warnings and recovery events will land here.</p>
        </div>
      ) : (
        <div className="notif-list fade-up d-2">
          {entries.map((entry) => {
            const sev = SEVERITY_META[entry.severity] || SEVERITY_META.info;
            const SevIcon = sev.icon;
            return (
              <div
                key={entry.id}
                className={`notif-card ${sev.cls} ${entry.read ? "read" : "unread"}`}
                onClick={() => !entry.read && handleReadOne(entry.id)}
                role={entry.read ? undefined : "button"}
                tabIndex={entry.read ? undefined : 0}
                onKeyDown={(event) => {
                  if (!entry.read && (event.key === "Enter" || event.key === " ")) {
                    event.preventDefault();
                    handleReadOne(entry.id);
                  }
                }}
              >
                <div className="notif-card-icon">
                  <SevIcon size={17} />
                </div>

                <div className="notif-card-body">
                  <div className="notif-card-title">{entry.title}</div>
                  {entry.message && <div className="notif-card-message">{entry.message}</div>}
                  <div className="notif-card-meta">
                    <span className={`notif-sev ${sev.cls}`}>{sev.label}</span>
                    {entry.service && <span>· {entry.service}</span>}
                    <span>· {relativeTime(entry.time)}</span>
                  </div>
                </div>

                {!entry.read && <span className="unread-dot" aria-label="Unread" />}

                <button
                  type="button"
                  className="notif-dismiss"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleRemove(entry.id);
                  }}
                  aria-label="Dismiss notification"
                >
                  <X size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
