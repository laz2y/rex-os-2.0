import "./Cloud.css";

import { useCallback, useEffect, useState } from "react";
import {
  Activity as ActivityIcon,
  AlertTriangle,
  Cloud as CloudIcon,
  ExternalLink,
  FileText,
  HardDrive,
  RefreshCw,
  Server,
  Users,
} from "lucide-react";

import { services } from "../data/services";
import {
  getNextcloudStatus,
  getNextcloudInfo,
  getNextcloudUsers,
  getNextcloudStorage,
  getNextcloudActivity,
} from "../api/nextcloud";

function formatBytes(bytes) {
  if (bytes == null) return null;

  const value = Number(bytes);
  if (!Number.isFinite(value)) return null;
  if (value <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let size = value;
  let index = 0;

  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }

  return `${size >= 100 ? Math.round(size) : size.toFixed(1)} ${units[index]}`;
}

function formatTime(iso) {
  if (!iso) return "Not available";

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Not available";

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function timeAgo(ms) {
  if (ms == null) return "—";

  const seconds = Math.round((Date.now() - ms) / 1000);
  if (seconds < 45) return "just now";

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function usageFor(user) {
  if (user?.unlimited) return null;
  if (user?.relative != null && user.relative >= 0) {
    return Math.min(100, user.relative);
  }
  if (user?.used != null && user?.total != null && user.total > 0) {
    return Math.min(100, (user.used / user.total) * 100);
  }
  return null;
}

function levelColor(value) {
  if (value == null) return "var(--primary)";
  if (value > 85) return "#ef4444";
  if (value > 70) return "#f59e0b";
  return "var(--primary)";
}

function initials(name) {
  return String(name || "?").trim().slice(0, 2).toUpperCase();
}

export default function Cloud() {
  const nextcloud = services.find((service) => service.id === "nextcloud");

  const [status, setStatus] = useState(null);
  const [info, setInfo] = useState(null);
  const [users, setUsers] = useState(null);
  const [storage, setStorage] = useState(null);
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setUnavailable(false);

    try {
      const st = await getNextcloudStatus();
      setStatus(st);

      // Server down — keep the section shells, every metric reports
      // "Not available" below the compact offline banner.
      if (!st.online) {
        setUnavailable(true);
        setInfo(null);
        setUsers(null);
        setStorage(null);
        setActivity(null);
        return;
      }

      const [infoRes, usersRes, storageRes, activityRes] =
        await Promise.allSettled([
          getNextcloudInfo(),
          getNextcloudUsers(),
          getNextcloudStorage(),
          getNextcloudActivity(),
        ]);

      setInfo(infoRes.status === "fulfilled" ? infoRes.value : null);
      setUsers(usersRes.status === "fulfilled" ? usersRes.value : null);
      setStorage(storageRes.status === "fulfilled" ? storageRes.value : null);
      setActivity(activityRes.status === "fulfilled" ? activityRes.value : null);
    } catch {
      setUnavailable(true);
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const online = status?.online === true;

  const stats = [
    { label: "Total Users", value: info?.totalUsers, icon: Users },
    {
      label: "Active Users",
      value: info?.activeUsers,
      icon: ActivityIcon,
      sub: "last 30 days",
    },
    {
      label: "Storage Used",
      value: storage?.used != null ? formatBytes(storage.used) : null,
      icon: HardDrive,
    },
    {
      label: "Storage Available",
      value: storage?.free != null ? formatBytes(storage.free) : null,
      icon: HardDrive,
    },
    {
      label: "Storage Usage",
      value:
        storage?.usagePercent != null ? `${storage.usagePercent}%` : null,
      icon: HardDrive,
      pct: storage?.usagePercent,
    },
    { label: "Total Files", value: info?.totalFiles, icon: FileText },
  ];

  const skeleton = (
    <div className="page">
      <div className="page-head fade-up">
        <h1>Cloud</h1>
        <p>Nextcloud — your NAS cloud storage</p>
      </div>

      <div className="nc-stats" aria-busy="true">
        {Array.from({ length: 6 }).map((_, index) => (
          <div className="nc-stat" key={index}>
            <div className="skeleton sk-title-sm" />
            <div className="skeleton nc-sk-value" />
          </div>
        ))}
      </div>

      <div className="nc-grid" aria-busy="true">
        <div className="skeleton nc-sk-card" />
        <div className="skeleton nc-sk-card" />
        <div className="skeleton nc-sk-card" />
        <div className="skeleton nc-sk-card" />
      </div>
    </div>
  );

  if (loading && !status) return skeleton;

  return (
    <div className="page">
      <div className="page-head fade-up">
        <h1>Cloud</h1>
        <p>Nextcloud — your NAS cloud storage</p>

        <div className="nc-head-actions">
          {nextcloud && (
            <a
              className="widget-link"
              href={nextcloud.url}
              target="_blank"
              rel="noreferrer"
            >
              Open Nextcloud
              <ExternalLink size={14} />
            </a>
          )}

          <button type="button" className="retry-btn" onClick={load}>
            <RefreshCw size={15} />
            Refresh
          </button>
        </div>
      </div>

      {!online && (
        <div className="offline-strip fade-up">
          <span>
            <AlertTriangle size={15} />
            Nextcloud unavailable
          </span>
          <button type="button" onClick={load}>
            <RefreshCw size={13} />
            Retry
          </button>
        </div>
      )}

      {/* Top statistics */}
      <div className="nc-stats">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          const hasValue = stat.value != null;

          return (
            <div key={stat.label} className={`nc-stat fade-up d-${index + 1}`}>
              <div className="nc-stat-head">
                <div className="nc-stat-icon">
                  <Icon size={16} />
                </div>
                <span className="nc-stat-label">
                  {stat.label}
                  {stat.sub && <em>{stat.sub}</em>}
                </span>
              </div>

              <div className={`nc-stat-value ${hasValue ? "" : "na"}`}>
                {hasValue ? stat.value : "Not available"}
              </div>

              {stat.pct != null && (
                <div className="nc-progress">
                  <div
                    className="nc-progress-fill"
                    style={{
                      width: `${Math.min(100, stat.pct)}%`,
                      background: levelColor(stat.pct),
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Server + storage overview */}
      <div className="nc-grid">
        <section className="nc-card fade-up">
          <div className="nc-card-head">
            <h2>
              <Server size={18} />
              Nextcloud Server
            </h2>

            <span className={`nc-server-state ${online ? "ok" : "bad"}`}>
              <span className={`foot-dot ${online ? "ok" : "bad"}`} />
              {online ? "Online" : "Offline"}
            </span>
          </div>

          <div className="nc-rows">
            <div className="nc-row">
              <span>Status</span>
              <strong style={{ color: online ? "#22c55e" : "#ef4444" }}>
                {online ? "Online" : "Offline"}
              </strong>
            </div>
            <div className="nc-row">
              <span>Version</span>
              <strong>{status?.versionString || "Not available"}</strong>
            </div>
            <div className="nc-row">
              <span>Product</span>
              <strong>{status?.product || "Not available"}</strong>
            </div>
            <div className="nc-row">
              <span>Maintenance</span>
              <strong>
                {status
                  ? status.maintenance
                    ? "Yes"
                    : "No"
                  : "Not available"}
              </strong>
            </div>
            <div className="nc-row">
              <span>DB upgrade</span>
              <strong>
                {status
                  ? status.needsDbUpgrade
                    ? "Required"
                    : "Not required"
                  : "Not available"}
              </strong>
            </div>
            <div className="nc-row">
              <span>Last checked</span>
              <strong>{formatTime(status?.lastChecked)}</strong>
            </div>
          </div>
        </section>

        <section className="nc-card fade-up">
          <div className="nc-card-head">
            <h2>
              <HardDrive size={18} />
              Storage Overview
            </h2>
          </div>

          {storage?.usagePercent != null ? (
            <>
              <div className="nc-storage-bar">
                <div className="nc-storage-track">
                  <div
                    className="nc-storage-fill"
                    style={{
                      width: `${Math.min(100, storage.usagePercent)}%`,
                      background: levelColor(storage.usagePercent),
                    }}
                  />
                </div>
                <strong>{storage.usagePercent}%</strong>
              </div>

              <div className="nc-rows">
                <div className="nc-row">
                  <span>Used</span>
                  <strong>{formatBytes(storage.used)}</strong>
                </div>
                <div className="nc-row">
                  <span>Free</span>
                  <strong>{formatBytes(storage.free)}</strong>
                </div>
                <div className="nc-row">
                  <span>Total</span>
                  <strong>{formatBytes(storage.total)}</strong>
                </div>
              </div>

              <p className="nc-note">
                Aggregated from Nextcloud user quotas
              </p>
            </>
          ) : (
            <div className="nc-unavailable">
              Storage overview not available
            </div>
          )}
        </section>

        {/* User storage */}
        <section className="nc-card fade-up">
          <div className="nc-card-head">
            <h2>
              <Users size={18} />
              User Storage
            </h2>

            {users?.total != null && (
              <span className="nc-count">{users.total} users</span>
            )}
          </div>

          {users?.users?.length ? (
            <div className="nc-table-wrap">
              <table className="nc-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Used</th>
                    <th>Quota</th>
                    <th>Usage</th>
                  </tr>
                </thead>
                <tbody>
                  {users.users.map((user) => {
                    const pct = usageFor(user);

                    return (
                      <tr key={user.id}>
                        <td>
                          <span className="nc-user">
                            <span className="nc-avatar">
                              {initials(user.displayName)}
                            </span>
                            <span>
                              <strong>{user.displayName}</strong>
                              <small>{user.id}</small>
                            </span>
                          </span>
                        </td>
                        <td>
                          {user.used != null
                            ? formatBytes(user.used)
                            : "—"}
                        </td>
                        <td>
                          {user.unlimited
                            ? "Unlimited"
                            : user.total != null
                            ? formatBytes(user.total)
                            : "—"}
                        </td>
                        <td>
                          {pct != null ? (
                            <span className="nc-user-pct">
                              <span className="nc-mini-track">
                                <span
                                  className="nc-mini-fill"
                                  style={{
                                    width: `${pct}%`,
                                    background: levelColor(pct),
                                  }}
                                />
                              </span>
                              {Math.round(pct)}%
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="nc-unavailable">
              {users?.available ? "No users found" : "Not available"}
            </div>
          )}
        </section>

        {/* Recent activity */}
        <section className="nc-card fade-up">
          <div className="nc-card-head">
            <h2>
              <ActivityIcon size={18} />
              Recent Activity
            </h2>
          </div>

          {activity?.activities?.length ? (
            <div className="nc-act-list">
              {activity.activities.map((item) => (
                <div className="nc-act-row" key={item.id}>
                  <span className="nc-act-dot" />
                  <div className="nc-act-body">
                    <strong>{item.subject || "Activity"}</strong>
                    <span>{item.user || "—"}</span>
                  </div>
                  <time>{timeAgo(item.timestamp)}</time>
                </div>
              ))}
            </div>
          ) : (
            <div className="nc-unavailable">
              {activity?.available ? "No recent activity" : "Not available"}
            </div>
          )}
        </section>
      </div>

      <p className="nc-foot fade-up">
        <CloudIcon size={13} />
        Nextcloud data comes from the REX API (
        <code style={{ color: "var(--primary)" }}>/api/nextcloud</code>) — all
        authentication happens server-side.
      </p>
    </div>
  );
}
