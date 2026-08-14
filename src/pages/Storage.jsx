import "./Storage.css";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Database,
  HardDrive,
  RefreshCw,
  Server,
} from "lucide-react";

import { getStorage } from "../api/storage";

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

function formatRate(value) {
  if (value == null || !Number.isFinite(value) || value <= 0) return "—";
  return `${formatBytes(value)}/s`;
}

function levelColor(level) {
  if (level === "CRITICAL") return "#ef4444";
  if (level === "WARNING") return "#f59e0b";
  return "var(--primary)";
}

function levelLabel(level) {
  if (level === "CRITICAL") return "Critical";
  if (level === "WARNING") return "Warning";
  if (level === "NORMAL") return "Normal";
  return "Unknown";
}

export default function Storage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getStorage();
      setData(result);
    } catch (err) {
      console.error("[REX OS] storage load failed:", err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const root = data?.root;
  const filesystems = data?.filesystems || [];
  const warnings = data?.warnings || [];
  const thresholds = data?.thresholds || { warn: 70, crit: 85 };
  const io = data?.io;

  const usedPct = root?.usedPercent ?? null;
  const level = root?.level || data?.overall || "UNKNOWN";

  const statCards = [
    {
      label: "Total capacity",
      value: formatBytes(root?.total),
      icon: Database,
      color: "var(--primary)",
    },
    {
      label: "Used",
      value: formatBytes(root?.used),
      icon: HardDrive,
      color: levelColor(level),
    },
    {
      label: "Free",
      value: formatBytes(root?.free),
      icon: Server,
      color: "#22c55e",
    },
    {
      label: "Usage",
      value: usedPct != null ? `${usedPct}%` : "—",
      icon: AlertTriangle,
      color: levelColor(level),
      sub: levelLabel(level),
    },
  ];

  return (
    <div className="page">
      <div className="page-head fade-up">
        <h1>Storage</h1>
        <p>Filesystems, usage thresholds and disk I/O on the NAS</p>
      </div>

      {/* Summary */}
      <div className="st-summary fade-up d-1">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div className="summary-chip" key={stat.label}>
              <div
                className="chip-icon"
                style={{ background: stat.color, boxShadow: `0 10px 24px ${stat.color}55` }}
              >
                <Icon size={22} />
              </div>
              <div>
                <strong>{stat.value}</strong>
                <span>
                  {stat.label}
                  {stat.sub ? ` · ${stat.sub}` : ""}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="offline-strip fade-up">
          <span>
            <AlertTriangle size={15} />
            Storage telemetry unavailable
          </span>
          <button type="button" onClick={load}>
            <RefreshCw size={13} />
            Retry
          </button>
        </div>
      )}

      {/* Root usage + thresholds */}
      <section className="st-card fade-up d-2">
        <div className="st-card-head">
          <h2>
            <HardDrive size={18} />
            Root Filesystem
          </h2>
          <span className={`st-level ${level.toLowerCase()}`}>
            <i /> {levelLabel(level)}
          </span>
        </div>

        {usedPct != null ? (
          <>
            <div className="st-bar">
              <div
                className={`st-bar-fill ${level.toLowerCase()}`}
                style={{ width: `${Math.min(100, usedPct)}%` }}
              />
            </div>

            <div className="st-bar-meta">
              <span>
                <strong>{usedPct}%</strong> used — {formatBytes(root.used)} of {formatBytes(root.total)}
              </span>
              <span>{formatBytes(root.free)} free</span>
              <span className="st-thresholds">
                Threshold {thresholds.warn}% warn · {thresholds.crit}% crit
              </span>
            </div>
          </>
        ) : (
          <p className="st-empty">Root filesystem usage is not available on this host.</p>
        )}
      </section>

      {/* Warnings */}
      {warnings.length > 0 && (
        <section className="st-card warn fade-up d-2">
          <div className="st-card-head">
            <h2>
              <AlertTriangle size={18} />
              Storage Warnings
            </h2>
          </div>
          <div className="st-warn-list">
            {warnings.map((warning) => (
              <div className="st-warn-row" key={`${warning.mount}-${warning.level}`}>
                <span className={`st-warn-dot ${warning.level.toLowerCase()}`} />
                <strong>{warning.mount}</strong>
                <span>
                  {warning.usedPercent}% used — {levelLabel(warning.level)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Filesystems */}
      <section className="st-card fade-up d-3">
        <div className="st-card-head">
          <h2>Filesystems</h2>
          <button type="button" className="refresh-btn" onClick={load} disabled={loading}>
            <RefreshCw size={15} className={loading ? "spin" : ""} />
            Refresh
          </button>
        </div>

        {loading && !data ? (
          <div aria-busy="true">
            {Array.from({ length: 4 }).map((_, index) => (
              <div className="st-fs-row skeleton-row" key={index}>
                <div className="skeleton sk-title" />
                <div className="skeleton sk-line" />
              </div>
            ))}
          </div>
        ) : filesystems.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <HardDrive size={24} />
            </div>
            <h3>No filesystems detected</h3>
            <p>df is unavailable on this host, or every mount is a virtual filesystem.</p>
          </div>
        ) : (
          <div>
            <div className="st-colhead" aria-hidden="true">
              <span>Filesystem</span>
              <span>Mount</span>
              <span>Type</span>
              <span>Usage</span>
              <span>Used / Free</span>
              <span />
            </div>

            {filesystems.map((fs) => (
              <div className="st-fs-row" key={`${fs.filesystem}-${fs.mount}`}>
                <div className="st-fs-name">
                  <strong title={fs.filesystem}>{fs.filesystem}</strong>
                </div>
                <div className="st-fs-mount" title={fs.mount}>
                  {fs.mount}
                </div>
                <div className="st-fs-type">{fs.type}</div>
                <div className="st-fs-bar-cell">
                  <div className="st-bar sm">
                    <div
                      className={`st-bar-fill ${String(fs.level).toLowerCase()}`}
                      style={{ width: `${Math.min(100, fs.usePercent)}%` }}
                    />
                  </div>
                  <span className="st-fs-pct">{fs.usePercent}%</span>
                </div>
                <div className="st-fs-amount">
                  {formatBytes(fs.used)} / {formatBytes(fs.total)}
                  <span className="st-fs-free">{formatBytes(fs.free)} free</span>
                </div>
                <span className={`st-level sm ${String(fs.level).toLowerCase()}`}>
                  {levelLabel(fs.level)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Disk I/O */}
      <section className="st-card fade-up d-4">
        <div className="st-card-head">
          <h2>
            <ArrowDownToLine size={18} />
            Disk I/O
          </h2>
          <span className="st-note">Sampled over a 1s window, cached server-side</span>
        </div>

        <div className="st-io">
          <div className="st-io-item">
            <div className="st-io-icon read">
              <ArrowDownToLine size={18} />
            </div>
            <div>
              <strong>{formatRate(io?.readBps)}</strong>
              <span>Read</span>
            </div>
          </div>
          <div className="st-io-item">
            <div className="st-io-icon write">
              <ArrowUpFromLine size={18} />
            </div>
            <div>
              <strong>{formatRate(io?.writeBps)}</strong>
              <span>Write</span>
            </div>
          </div>
          <div className="st-io-item">
            <div className="st-io-icon ops">
              <Database size={18} />
            </div>
            <div>
              <strong>
                {io?.readOps ?? "—"}
                <em>/</em>
                {io?.writeOps ?? "—"}
              </strong>
              <span>Read / Write ops</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
