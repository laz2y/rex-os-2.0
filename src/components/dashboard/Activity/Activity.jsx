import "./Activity.css";

import { memo, useEffect, useState } from "react";
import {
  Activity as ActivityIcon,
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Download,
  HardDrive,
  Info,
  RefreshCw,
  Workflow,
  XCircle,
} from "lucide-react";

import { getActivity } from "../../../api/activity";

const SEVERITY_META = {
  info: { label: "INFO", icon: Info, cls: "info", color: "var(--primary)" },
  success: { label: "SUCCESS", icon: CheckCircle2, cls: "success", color: "#22c55e" },
  warning: { label: "WARNING", icon: AlertTriangle, cls: "warning", color: "#f59e0b" },
  error: { label: "ERROR", icon: XCircle, cls: "error", color: "#ef4444" },
  critical: { label: "CRITICAL", icon: XCircle, cls: "critical", color: "#ef4444" },
};

const TYPE_ICONS = {
  docker: Boxes,
  recovery: RefreshCw,
  pipeline: Workflow,
  downloads: Download,
  storage: HardDrive,
  diagnostics: ActivityIcon,
};

function relativeTime(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 45000) return "just now";
  if (diff < 3600000) return `${Math.max(1, Math.floor(diff / 60000))}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function RowSkeleton() {
  return (
    <div className="activity-item" aria-busy="true">
      <div className="skeleton activity-sk-icon" />
      <div className="activity-info">
        <div className="skeleton sk-title-sm" />
        <div className="skeleton sk-sub-sm" />
      </div>
    </div>
  );
}

/** Compact real activity feed — newest events recorded by the REX backend. */
function Activity() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const data = await getActivity({ limit: 8 });
        if (active) {
          setEntries(data.entries || []);
          setError(null);
        }
      } catch (err) {
        console.error("[REX OS] activity poll failed:", err);
        if (active) setError(err);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    // Refresh while the tab is visible; skip ticks when hidden.
    const interval = setInterval(() => {
      if (!document.hidden) load();
    }, 30000);

    function onVisible() {
      if (!document.hidden) load();
    }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      active = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return (
    <section className="activity fade-up">
      <div className="activity-header">
        <h2>Recent Activity</h2>
      </div>

      {loading && entries.length === 0 ? (
        <div className="activity-list">
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </div>
      ) : error && entries.length === 0 ? (
        <div className="notif-error">
          <AlertTriangle size={15} />
          <span>Could not reach the activity log</span>
        </div>
      ) : entries.length === 0 ? (
        <div className="notif-empty">
          <ActivityIcon size={20} />
          <p>No activity recorded yet.</p>
        </div>
      ) : (
        <div className="activity-list">
          {entries.map((item) => {
            const sev = SEVERITY_META[item.severity] || SEVERITY_META.info;
            const SevIcon = sev.icon;
            const TypeIcon = TYPE_ICONS[item.type] || Info;

            return (
              <div className="activity-item" key={item.id}>
                <div
                  className="activity-icon"
                  style={{
                    background: sev.color,
                    boxShadow: `0 8px 18px ${sev.color}33`,
                  }}
                >
                  <TypeIcon size={18} />
                </div>

                <div className="activity-info">
                  <h4>{item.message || item.action || "REX OS event"}</h4>
                  <span>
                    <SevIcon size={11} className={`activity-sev-icon ${sev.cls}`} />
                    {relativeTime(item.time)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default memo(Activity);
