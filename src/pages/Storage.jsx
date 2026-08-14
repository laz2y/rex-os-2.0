import "./Storage.css";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  HardDrive,
  RefreshCw,
  Server,
} from "lucide-react";

import { getStorage } from "../api/storage";

const POLL_MS = 30000;

function formatBytes(bytes) {
  if (!bytes) return "—";
  const gb = bytes / 1024 / 1024 / 1024;
  return gb >= 1024 ? `${(gb / 1024).toFixed(1)} TB` : `${gb.toFixed(1)} GB`;
}

function levelColor(level) {
  switch (level) {
    case "CRITICAL":
      return "#ef4444";
    case "WARNING":
      return "#f59e0b";
    case "NORMAL":
      return "#22c55e";
    default:
      return "var(--primary)";
  }
}

function LevelBadge({ level }) {
  if (!level) return null;
  return (
    <span
      className="storage-level"
      style={{ color: levelColor(level), borderColor: `${levelColor(level)}55` }}
    >
      {level}
    </span>
  );
}

function UsageBar({ percent, warn, crit }) {
  const color =
    percent > crit ? "#ef4444" : percent > warn ? "#f59e0b" : "var(--primary)";
  const width = Math.max(0, Math.min(100, percent ?? 0));

  return (
    <div className="storage-bar-wrap">
      <div className="storage-bar">
        <div className="storage-bar-fill" style={{ width: `${width}%`, background: color }} />
        {warn != null && (
          <span className="storage-mark" style={{ left: `${warn}%` }} title={`WARNING at ${warn}%`} />
        )}
        {crit != null && (
          <span className="storage-mark crit" style={{ left: `${crit}%` }} title={`CRITICAL at ${crit}%`} />
        )}
      </div>
    </div>
  );
}

export default function StoragePage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const pollTimer = useRef(null);

  const load = useCallback(async () => {
    try {
      const result = await getStorage();
      setData(result);
      setError(null);
    } catch (err) {
      console.error("[REX OS] storage load failed:", err);
      if (!data) setError(err);
    } finally {
      setLoading(false);
    }
  }, [data]);

  useEffect(() => {
    load();
    pollTimer.current = setInterval(() => {
      if (!document.hidden) load();
    }, POLL_MS);
    return () => clearInterval(pollTimer.current);
  }, [load]);

  if (loading && !data) {
    return (
      <div className="page">
        <div className="page-head fade-up">
          <h1>Storage</h1>
          <p>Filesystems &amp; Capacity</p>
        </div>
        <div className="skeleton storage-hero-sk" />
        <div className="skeleton storage-panel-sk" />
        <div className="skeleton storage-panel-sk" />
      </div>
    );
  }

  const root = data?.root || null;
  const filesystems = data?.filesystems || [];
  const warnings = data?.warnings || [];
  const io = data?.io || null;
  const thresholds = data?.thresholds || { warn: 70, crit: 85 };

  return (
    <div className="page">
      <div className="page-head fade-up">
        <h1>Storage</h1>
        <p>Filesystems &amp; Capacity</p>

        <div className="storage-head-actions">
          <span className="storage-overall" style={{ color: levelColor(data?.overall) }}>
            <i style={{ background: levelColor(data?.overall) }} />
            {data?.overall || "UNKNOWN"}
          </span>
          <button type="button" className="refresh-btn" onClick={load} disabled={loading}>
            <RefreshCw size={15} className={loading ? "spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="offline-strip fade-up">
          <span>Storage information unavailable — showing the last known snapshot</span>
          <button type="button" onClick={load}>
            <RefreshCw size={13} />
            Retry
          </button>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="storage-warnings fade-up d-1">
          {warnings.map((warning) => (
            <div className="storage-warning" key={warning.mount}>
              <AlertTriangle size={16} />
              <div>
                <strong>
                  {warning.mount} — {warning.usedPercent}% used
                </strong>
                <span>
                  {warning.level} threshold reached (WARNING &gt; {thresholds.warn}% · CRITICAL &gt;{" "}
                  {thresholds.crit}%)
                </span>
              </div>
              <LevelBadge level={warning.level} />
            </div>
          ))}
        </div>
      )}

      <div className="storage-grid fade-up d-1">
        {/* Root filesystem hero */}
        <section className="storage-hero">
          <div className="storage-hero-head">
            <div className="storage-hero-icon">
              <HardDrive size={24} />
            </div>
            <div>
              <h2>Root filesystem</h2>
              <span>{root ? "Primary volume" : "Unavailable"}</span>
            </div>
            <LevelBadge level={root?.level} />
          </div>

          {root ? (
            <>
              <div className="storage-hero-nums">
                <div>
                  <strong>{formatBytes(root.total)}</strong>
                  <span>Total</span>
                </div>
                <div>
                  <strong style={{ color: levelColor(root.level) }}>{formatBytes(root.used)}</strong>
                  <span>Used · {root.usedPercent}%</span>
                </div>
                <div>
                  <strong>{formatBytes(root.free)}</strong>
                  <span>Free</span>
                </div>
              </div>

              <UsageBar percent={root.usedPercent} warn={thresholds.warn} crit={thresholds.crit} />

              <p className="storage-hero-thresholds">
                Thresholds — WARNING &gt; {thresholds.warn}% · CRITICAL &gt; {thresholds.crit}%
              </p>
            </>
          ) : (
            <p className="storage-na">Root filesystem usage is not available on this host.</p>
          )}
        </section>

        {/* Disk I/O */}
        <section className="storage-panel storage-io">
          <h2>
            <ArrowDownToLine size={17} />
            Disk I/O
          </h2>
          {io ? (
            <div className="io-row">
              <div>
                <strong className="io-read">↓ {formatRate(io.readBps)}</strong>
                <span>read</span>
              </div>
              <div>
                <strong className="io-write">↑ {formatRate(io.writeBps)}</strong>
                <span>write</span>
              </div>
              <div>
                <strong>
                  {io.readOps ?? "—"} / {io.writeOps ?? "—"}
                </strong>
                <span>read / write ops</span>
              </div>
            </div>
          ) : (
            <p className="storage-na">Disk I/O is not available on this host.</p>
          )}
        </section>
      </div>

      {/* Filesystem table */}
      <section className="storage-panel fade-up d-2">
        <h2>
          <Server size={17} />
          Filesystems <em>{filesystems.length ? `(${filesystems.length})` : ""}</em>
        </h2>

        {filesystems.length ? (
          <div className="storage-table">
            <div className="storage-colhead" aria-hidden="true">
              <span>Mount</span>
              <span>Type</span>
              <span>Total</span>
              <span>Used</span>
              <span>Free</span>
              <span>Usage</span>
              <span>Status</span>
            </div>
            {filesystems.map((fs) => (
              <div className="storage-row" key={`${fs.filesystem}-${fs.mount}`}>
                <div className="storage-mount">
                  <strong title={fs.filesystem}>{fs.mount}</strong>
                  <span title={fs.filesystem}>{fs.filesystem}</span>
                </div>
                <span className="storage-type">{fs.type}</span>
                <span>{formatBytes(fs.total)}</span>
                <span>{formatBytes(fs.used)}</span>
                <span>{formatBytes(fs.free)}</span>
                <div className="storage-cell-usage">
                  <div className="usage-track">
                    <div
                      className="usage-fill"
                      style={{
                        width: `${Math.max(0, Math.min(100, fs.usePercent))}%`,
                        background: levelColor(fs.level),
                      }}
                    />
                  </div>
                  <span>{fs.usePercent}%</span>
                </div>
                <LevelBadge level={fs.level} />
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state compact">
            <div className="empty-icon">
              <HardDrive size={24} />
            </div>
            <h3>No filesystems detected</h3>
            <p>This host did not report any real filesystems.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function formatRate(value) {
  if (value == null || !Number.isFinite(value) || value <= 0) return "—";
  const mb = value / 1024 / 1024;
  return `${mb.toFixed(2)} MB/s`;
}
