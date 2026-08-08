import "./Photos.css";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Camera,
  ExternalLink,
  Film,
  FolderOpen,
  HardDrive,
  Images,
  RefreshCw,
  Server,
  Video,
} from "lucide-react";

import { services } from "../data/services";
import { getImmichOverview } from "../api/immich";

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

function formatCount(value) {
  if (value == null) return null;
  return Number(value).toLocaleString();
}

export default function Photos() {
  const immich = services.find((service) => service.id === "immich");

  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setUnavailable(false);

    try {
      const data = await getImmichOverview();
      setOverview(data);

      if (!data.online) {
        setUnavailable(true);
      }
    } catch {
      setUnavailable(true);
      setOverview(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const online = overview?.online === true;
  const stats = overview?.statistics;

  const statCards = [
    { label: "Photos", value: formatCount(stats?.photos), icon: Images },
    { label: "Videos", value: formatCount(stats?.videos), icon: Video },
    {
      label: "Albums",
      value: formatCount(overview?.albums?.length),
      icon: FolderOpen,
    },
    {
      label: "Total Assets",
      value: formatCount(stats?.total),
      icon: HardDrive,
      pct:
        stats && stats.total > 0
          ? Math.round((stats.photos / stats.total) * 100)
          : null,
      sub: "photos share",
    },
  ];

  const skeleton = (
    <div className="page">
      <div className="page-head fade-up">
        <h1>Photos</h1>
        <p>Your Immich library</p>
      </div>

      <div className="ph-stats" aria-busy="true">
        {Array.from({ length: 4 }).map((_, index) => (
          <div className="ph-stat" key={index}>
            <div className="skeleton sk-title-sm" />
            <div className="skeleton ph-sk-value" />
          </div>
        ))}
      </div>

      <div className="ph-grid" aria-busy="true">
        <div className="skeleton ph-sk-card" />
        <div className="skeleton ph-sk-card" />
      </div>
    </div>
  );

  if (loading && !overview) return skeleton;

  return (
    <div className="page">
      <div className="page-head fade-up">
        <h1>Photos</h1>
        <p>Your Immich library</p>

        <div className="ph-head-actions">
          {immich && (
            <a
              className="widget-link"
              href={immich.url}
              target="_blank"
              rel="noreferrer"
            >
              Open Immich
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
            Immich unavailable
          </span>
          <button type="button" onClick={load}>
            <RefreshCw size={13} />
            Retry
          </button>
        </div>
      )}

      {/* Top statistics */}
      <div className="ph-stats">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          const hasValue = stat.value != null;

          return (
            <div key={stat.label} className={`ph-stat fade-up d-${index + 1}`}>
              <div className="ph-stat-head">
                <div className="ph-stat-icon">
                  <Icon size={16} />
                </div>
                <span className="ph-stat-label">
                  {stat.label}
                  {stat.sub && <em>{stat.sub}</em>}
                </span>
              </div>

              <div className={`ph-stat-value ${hasValue ? "" : "na"}`}>
                {hasValue ? stat.value : "Not available"}
              </div>

              {stat.pct != null && (
                <div className="ph-progress">
                  <div
                    className="ph-progress-fill"
                    style={{ width: `${Math.min(100, stat.pct)}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Immich overview + library */}
      <div className="ph-grid">
        <section className="ph-card fade-up">
          <div className="ph-card-head">
            <h2>
              <Server size={18} />
              Immich Overview
            </h2>

            <span className={`ph-server-state ${online ? "ok" : "bad"}`}>
              <span className={`foot-dot ${online ? "ok" : "bad"}`} />
              {online ? "Online" : "Offline"}
            </span>
          </div>

          <div className="ph-rows">
            <div className="ph-row">
              <span>Status</span>
              <strong style={{ color: online ? "#22c55e" : "#ef4444" }}>
                {online ? "Online" : "Offline"}
              </strong>
            </div>
            <div className="ph-row">
              <span>Version</span>
              <strong>{overview?.version || "Not available"}</strong>
            </div>
            <div className="ph-row">
              <span>Server</span>
              <strong>{immich?.url || "Not available"}</strong>
            </div>
            <div className="ph-row">
              <span>Last checked</span>
              <strong>{formatTime(overview?.lastChecked)}</strong>
            </div>
          </div>
        </section>

        <section className="ph-card fade-up">
          <div className="ph-card-head">
            <h2>
              <Camera size={18} />
              Library Overview
            </h2>

            {stats?.total != null && (
              <span className="ph-count">{formatCount(stats.total)} assets</span>
            )}
          </div>

          {stats && stats.total > 0 ? (
            <>
              <div className="ph-storage-bar">
                <div className="ph-storage-track">
                  <div
                    className="ph-storage-fill"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round((stats.photos / stats.total) * 100),
                      )}%`,
                    }}
                  />
                </div>
                <strong>{formatCount(stats.photos)}</strong>
              </div>

              <div className="ph-rows">
                <div className="ph-row">
                  <span>Photos</span>
                  <strong>{formatCount(stats.photos)}</strong>
                </div>
                <div className="ph-row">
                  <span>Videos</span>
                  <strong>{formatCount(stats.videos)}</strong>
                </div>
                <div className="ph-row">
                  <span>Total</span>
                  <strong>{formatCount(stats.total)}</strong>
                </div>
              </div>

              <p className="ph-note">Photos vs videos, from Immich statistics</p>
            </>
          ) : (
            <div className="ph-unavailable">Library statistics not available</div>
          )}
        </section>

        {/* Albums */}
        <section className="ph-card fade-up ph-span-2">
          <div className="ph-card-head">
            <h2>
              <FolderOpen size={18} />
              Albums
            </h2>

            {overview?.albums?.length != null && (
              <span className="ph-count">{overview.albums.length} albums</span>
            )}
          </div>

          {overview?.albums?.length ? (
            <div className="ph-album-list">
              {overview.albums.map((album) => (
                <div className="ph-album-row" key={album.id}>
                  <div className="ph-album-art">
                    <Images size={16} />
                  </div>
                  <div className="ph-album-body">
                    <strong>{album.name}</strong>
                    <span>{album.assetCount} assets</span>
                  </div>
                  {album.createdAt && (
                    <time>
                      {new Date(album.createdAt).toLocaleDateString([], {
                        year: "numeric",
                        month: "short",
                      })}
                    </time>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="ph-unavailable">
              {overview?.albums
                ? "No albums found"
                : "Albums not available"}
            </div>
          )}
        </section>
      </div>

      <p className="ph-foot fade-up">
        <Film size={13} />
        Immich data comes from the REX API (
        <code style={{ color: "var(--primary)" }}>/api/immich</code>) — the API
        key stays server-side.
      </p>
    </div>
  );
}
