import "./Pipeline.css";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  CheckCircle2,
  Clapperboard,
  Clock3,
  Download,
  ExternalLink,
  Film,
  HardDrive,
  Info,
  Link2,
  Loader2,
  Magnet,
  PackageOpen,
  Pause,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  Tv,
  Upload,
  XCircle,
} from "lucide-react";

import {
  getPipeline,
  restartPipelineService,
  restartPipelineGroup,
} from "../services/pipelineService";
import { services } from "../data/services";
import { success as toastSuccess, error as toastError, warning as toastWarning } from "../services/toastService";

const POLL_MS = 8000;

const STATUS_CLS = {
  connected: "ok",
  not_configured: "na",
  offline: "bad",
  auth_failed: "bad",
  error: "warn",
};

const STATUS_LABEL = {
  connected: "Connected",
  not_configured: "Not configured",
  offline: "Offline",
  auth_failed: "Authentication failed",
  error: "Error",
};

const STAGE_LABEL = {
  connected: "Online",
  not_configured: "Not configured",
  offline: "Offline",
  auth_failed: "Auth failed",
  error: "Error",
};

const ACTIVITY_META = {
  downloading: { icon: Download, label: "Downloading" },
  queued: { icon: Clock3, label: "Queued" },
  torrenting: { icon: Magnet, label: "Torrenting" },
  stalled: { icon: Pause, label: "Stalled" },
  seeding: { icon: Upload, label: "Seeding" },
  grabbed: { icon: Search, label: "Grabbed" },
  imported: { icon: CheckCircle2, label: "Imported" },
  failed: { icon: XCircle, label: "Failed" },
  deleted: { icon: Trash2, label: "Deleted" },
  event: { icon: Info, label: "Event" },
};

function formatSpeed(value) {
  if (value == null || !Number.isFinite(value)) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size >= 100 || unit === 0 ? Math.round(size) : size.toFixed(1)} ${units[unit]}/s`;
}

function relativeTime(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 45000) return "just now";
  if (diff < 3600000) return `${Math.max(1, Math.floor(diff / 60000))}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function prettyState(state) {
  if (!state) return "";
  if (state === "importing" || state === "importPending") return "Importing…";
  if (state === "downloading") return "Downloading…";
  if (state === "queued") return "Queued";
  if (state === "completed") return "Completed";
  if (state === "failed") return "Failed";
  if (state === "checking") return "Checking…";
  if (state === "stalled") return "Stalled";
  return String(state).replace(/^./, (c) => c.toUpperCase());
}

function Stage({ name, sub, icon: Icon, cls, label, optional }) {
  return (
    <div className="pipe-stage">
      <div className={`pipe-stage-badge ${cls}`}>
        <Icon size={22} />
        {optional && <span className="pipe-stage-optional">optional</span>}
      </div>
      <strong>{name}</strong>
      <span className="pipe-stage-sub">{sub}</span>
      <span className={`pipe-stage-status ${cls}`}>
        <i /> {label}
      </span>
    </div>
  );
}

function ServiceCard({ card, restarting, onRestart }) {
  const connected = card.status === "connected";

  return (
    <article className={`pipe-card ${connected ? "online" : "down"}`}>
      <div className="pipe-card-head">
        <div className="pipe-card-icon" style={{ background: card.color }}>
          <card.icon size={20} />
        </div>

        <div className="pipe-card-title">
          <h3>
            {card.name}
            {card.version && <em>{card.version}</em>}
          </h3>
          <span className={`pipe-status ${card.cls}`}>
            <i />
            {card.label}
          </span>
        </div>

        {card.url && (
          <a
            className="pipe-open"
            href={card.url}
            target="_blank"
            rel="noreferrer"
            title={`Open ${card.name}`}
            aria-label={`Open ${card.name}`}
          >
            <ExternalLink size={14} />
          </a>
        )}
      </div>

      {connected ? (
        <>
          <div className="pipe-stats">
            {card.stats.map(([label, value], index) => (
              <div className="pipe-stat" key={label}>
                <strong key={`v-${index}`}>{value}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>

          {card.failedCount > 0 && (
            <div className="pipe-failed">
              <XCircle size={14} />
              {card.failedCount} failed {card.name === "Radarr" ? "movie" : "episode"}{card.failedCount > 1 ? "s" : ""} in queue
            </div>
          )}

          {card.current && (
            <div className="pipe-current">
              <b>Currently</b>
              <span className="pipe-current-title" title={card.current.title}>
                {card.current.title}
              </span>
              <span className="pipe-current-state">{prettyState(card.current.state)}</span>
              {card.current.progress != null && (
                <span className="pipe-current-progress">
                  {Math.round(card.current.progress)}%
                </span>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="pipe-offline">
          <AlertTriangle size={16} />
          <span>{card.error}</span>
        </div>
      )}

      {onRestart && (
        <button
          type="button"
          className={`pipe-restart ${restarting ? "busy" : ""}`}
          onClick={() => onRestart(card.id)}
          disabled={restarting}
          title={`Restart ${card.name} and verify health`}
        >
          <RotateCcw size={14} className={restarting ? "spin" : ""} />
          {restarting ? "Restarting…" : "Restart"}
        </button>
      )}
    </article>
  );
}

function CardSkeleton() {
  return (
    <div className="pipe-card skeleton-card" aria-busy="true">
      <div className="skeleton sk-icon" />
      <div className="skeleton sk-title-sm" />
      <div className="skeleton sk-line" />
      <div className="skeleton sk-line" />
    </div>
  );
}

const PIPE_STATE_META = {
  IDLE: { label: "Idle", cls: "idle" },
  RUNNING: { label: "Running", cls: "running" },
  SUCCESS: { label: "Success", cls: "success" },
  FAILED: { label: "Failed", cls: "failed" },
  DEGRADED: { label: "Degraded", cls: "degraded" },
  RECOVERING: { label: "Recovering", cls: "recovering" },
};

export default function Pipeline() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reload, setReload] = useState(0);
  const [restarting, setRestarting] = useState(null);
  const [restartingAll, setRestartingAll] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await getPipeline();
      setData(result);
      setError(null);
    } catch (err) {
      console.error("[REX OS] pipeline load failed:", err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll while the tab is visible; pause updates when hidden.
  useEffect(() => {
    load();
    const timer = setInterval(() => {
      if (!document.hidden) load();
    }, POLL_MS);

    function onVisible() {
      if (!document.hidden) load();
    }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load, reload]);

  const s = data?.services || {};
  const activity = data?.activity || [];

  const qbService = services.find((item) => item.id === "qbittorrent");
  const radarrService = services.find((item) => item.id === "radarr");
  const sonarrService = services.find((item) => item.id === "sonarr");
  const jellyfinService = services.find((item) => item.id === "jellyfin");

  const cards = useMemo(() => {
    const build = (id, name, icon, color, section, stats, current, url) => ({
      id,
      name,
      icon,
      color,
      status: section?.status || "not_configured",
      cls: STATUS_CLS[section?.status] || "na",
      label: STATUS_LABEL[section?.status] || "Not configured",
      error: section?.error || section?.detail || "Unavailable",
      version: section?.version || "",
      failedCount: section?.failedCount || 0,
      stats,
      current,
      url,
    });

    return [
      build("pyload", "pyLoad", PackageOpen, "#f59e0b", s.pyload, [
        ["Active downloads", s.pyload?.activeDownloads ?? 0],
        ["Queued packages", s.pyload?.queuedPackages ?? 0],
        ["Links queued", s.pyload?.queuedLinks ?? 0],
      ], s.pyload?.current || null, s.pyload?.url || null),

      build("qbittorrent", "qBittorrent", Magnet, "#2563eb", s.qbittorrent, [
        ["Active", s.qbittorrent?.activeCount ?? 0],
        ["Seeding", s.qbittorrent?.seedingCount ?? 0],
        ["Total", s.qbittorrent?.totalCount ?? 0],
        ["Down", formatSpeed(s.qbittorrent?.downloadSpeed)],
        ["Up", formatSpeed(s.qbittorrent?.uploadSpeed)],
      ], s.qbittorrent?.current || null, qbService?.url || null),

      build("radarr", "Radarr", Film, "#eab308", s.radarr, [
        ["Queue", s.radarr?.queueCount ?? 0],
        ["Importing", s.radarr?.importingCount ?? 0],
        ["Missing", s.radarr?.missingCount ?? 0],
        ["Movies", s.radarr?.movieCount ?? 0],
      ], s.radarr?.current || null, radarrService?.url || null),

      build("sonarr", "Sonarr", Tv, "#f43f5e", s.sonarr, [
        ["Queue", s.sonarr?.queueCount ?? 0],
        ["Importing", s.sonarr?.importingCount ?? 0],
        ["Missing", s.sonarr?.missingCount ?? 0],
        ["Series", s.sonarr?.seriesCount ?? 0],
      ], s.sonarr?.current || null, sonarrService?.url || null),

      build("jellyfin", "Jellyfin", Clapperboard, "#8b5cf6", s.jellyfin, [
        ["Server", s.jellyfin?.serverName || "—"],
        ["Version", s.jellyfin?.version ? `v${s.jellyfin.version}` : "—"],
      ], null, jellyfinService?.url || null),
    ];
  }, [s, qbService, radarrService, sonarrService, jellyfinService]);

  const stageCls = (section) => STATUS_CLS[section?.status] || "na";
  const stageLabel = (section) => STAGE_LABEL[section?.status] || "Not configured";

  const arrConnected = s.radarr?.status === "connected" || s.sonarr?.status === "connected";
  const arrCls = arrConnected
    ? "ok"
    : s.radarr?.status === "auth_failed" || s.sonarr?.status === "auth_failed"
    ? "bad"
    : stageCls(s.radarr) === "bad" || stageCls(s.sonarr) === "bad"
    ? "bad"
    : "na";
  const arrLabel = arrConnected
    ? "Online"
    : s.radarr?.status === "auth_failed" || s.sonarr?.status === "auth_failed"
    ? "Auth failed"
    : "Offline";

  const mediaReady = arrConnected || s.jellyfin?.status === "connected";

  function refresh() {
    setLoading(true);
    setReload((value) => value + 1);
  }

  /**
   * Controlled full-pipeline restart with confirmation. Uses the existing
   * group-restart endpoint: services restart one at a time and each is
   * verified healthy before the next starts — never a blind restart.
   */
  async function handleRestartPipeline() {
    if (
      !window.confirm(
        "Restart the entire pipeline (pyLoad → qBittorrent → Radarr → Sonarr → Jellyfin)?\n\nEach service restarts one at a time and is verified healthy before the next starts."
      )
    ) {
      return;
    }

    setRestartingAll(true);
    try {
      const result = await restartPipelineGroup("all");
      const failed = (result.results || []).filter((item) => !item.ok);
      if (failed.length === 0) {
        toastSuccess("Pipeline restarted and verified healthy.");
      } else {
        const names = failed.map((item) => item.id).join(", ");
        toastWarning(
          failed.length === 1
            ? `Pipeline restarted, but ${names} did not come back healthy.`
            : `Pipeline restarted, but some services did not come back healthy: ${names}.`
        );
      }
      refresh();
    } catch (err) {
      toastError(
        err?.response?.data?.error || "Pipeline restart failed."
      );
    } finally {
      setRestartingAll(false);
    }
  }

  /** Controlled restart with confirmation — backend verifies health after. */
  async function handleRestart(serviceId) {
    const name = cards.find((card) => card.id === serviceId)?.name || serviceId;
    if (!window.confirm(`Restart ${name}? REX OS will restart its container and verify the service comes back healthy.`)) {
      return;
    }

    setRestarting(serviceId);
    try {
      const result = await restartPipelineService(serviceId);
      if (result.verified) {
        toastSuccess(`${name} restarted and verified healthy.`);
      } else {
        toastWarning(result.warning || `${name} restarted, but the health check timed out.`);
      }
      refresh();
    } catch (err) {
      const message = err?.response?.data?.error || "Restart failed.";
      toastError(message);
    } finally {
      setRestarting(null);
    }
  }

  const pipe = data?.pipeline || {};
  const pipeMeta = PIPE_STATE_META[pipe.state] || PIPE_STATE_META.IDLE;

  return (
    <div className="page">
      <div className="page-head fade-up">
        <h1>Pipeline</h1>
        <p>Direct Link → pyLoad → qBittorrent → Radarr / Sonarr → Media → Jellyfin</p>
      </div>

      {/* Pipeline Control Center */}
      <section className={`pipe-control fade-up d-1 state-${pipeMeta.cls}`}>
        <div className="pipe-control-state">
          <span className={`pipe-state-badge ${pipeMeta.cls}`}>
            <i />
            {pipeMeta.label}
          </span>
          <div className="pipe-control-title">
            <h2>Pipeline Control Center</h2>
            <span>Health: {pipe.health || "—"}</span>
          </div>
        </div>

        <div className="pipe-control-stats">
          <div>
            <span>Last success</span>
            <strong>{relativeTime(pipe.lastSuccess)}</strong>
          </div>
          <div>
            <span>Last failure</span>
            <strong>{relativeTime(pipe.lastFailure)}</strong>
          </div>
          <div>
            <span>Execution</span>
            <strong>{pipe.executionMs != null ? `${pipe.executionMs}ms` : "—"}</strong>
          </div>
          <div>
            <span>Operation</span>
            <strong title={pipe.operation || ""}>{pipe.operation || "—"}</strong>
          </div>
        </div>

        <div className="pipe-control-actions">
          <button
            type="button"
            className="pipe-restart-pipeline"
            onClick={handleRestartPipeline}
            disabled={restartingAll}
            title="Restart the whole pipeline — each service is restarted and verified one at a time"
          >
            <RotateCcw size={15} className={restartingAll ? "spin" : ""} />
            {restartingAll ? "Restarting…" : "Restart Pipeline"}
          </button>
        </div>
      </section>

      {/* Visual pipeline */}
      <section className="pipe-flow-card fade-up d-1">
        <div className="pipe-flow" role="img" aria-label="Media pipeline flow">
          <Stage name="Direct Link" sub="REX" icon={Link2} cls="ok" label="Active" />
          <ArrowRight size={22} className="pipe-arrow" />

          <Stage name="pyLoad" sub="Downloads" icon={PackageOpen} cls={stageCls(s.pyload)} label={stageLabel(s.pyload)} />
          <ArrowRight size={22} className="pipe-arrow" />

          <Stage name="qBittorrent" sub="Torrents" icon={Magnet} cls={stageCls(s.qbittorrent)} label={stageLabel(s.qbittorrent)} optional />
          <ArrowRight size={22} className="pipe-arrow" />

          <Stage name="Radarr / Sonarr" sub="Movies & TV" icon={Film} cls={arrCls} label={arrLabel} />
          <ArrowRight size={22} className="pipe-arrow" />

          <Stage name="Media" sub="Library" icon={HardDrive} cls={mediaReady ? "ok" : "na"} label={mediaReady ? "Ready" : "Idle"} />
          <ArrowRight size={22} className="pipe-arrow" />

          <Stage name="Jellyfin" sub="Streaming" icon={Clapperboard} cls={stageCls(s.jellyfin)} label={stageLabel(s.jellyfin)} />
        </div>

        <p className="pipe-flow-note">
          <Magnet size={13} />
          Torrents enter at qBittorrent; direct links enter at pyLoad — not every download passes
          through every stage.
        </p>
      </section>

      {/* Service cards */}
      <div className="pipe-cards fade-up d-2">
        {loading && !data ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : (
          cards.map((card) => (
            <ServiceCard
              key={card.id}
              card={card}
              restarting={restarting === card.id}
              onRestart={handleRestart}
            />
          ))
        )}
      </div>

      {/* Activity */}
      <section className="pipe-card-wide fade-up d-3">
        <div className="qb-table-header">
          <div>
            <h2>Recent Activity</h2>
            {data?.generatedAt && (
              <span className="qb-version">Updated {relativeTime(data.generatedAt)}</span>
            )}
          </div>

          <button
            type="button"
            className="refresh-btn"
            onClick={refresh}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? "spin" : ""} />
            Refresh
          </button>
        </div>

        {loading && !data ? (
          <div aria-busy="true">
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
              <h3>Pipeline unavailable</h3>
              <p>
                {error?.response?.data?.error ||
                  "Could not reach the REX backend. Make sure the API is running."}
              </p>
            </div>
            <button type="button" className="retry-btn" onClick={refresh}>
              <RefreshCw size={16} />
              Retry
            </button>
          </div>
        ) : activity.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <Clock3 size={24} />
            </div>
            <h3>No recent activity</h3>
            <p>
              The pipeline is idle. New downloads, grabs and imports will appear
              here automatically.
            </p>
          </div>
        ) : (
          <div className="pipe-activity">
            {activity.map((item) => {
              const meta = ACTIVITY_META[item.type] || ACTIVITY_META.event;
              const Icon = meta.icon;
              return (
                <div key={item.id} className={`pipe-event type-${item.type}`}>
                  <div className="pipe-event-icon">
                    <Icon size={16} />
                  </div>

                  <div className="pipe-event-body">
                    <div className="pipe-event-title" title={item.title}>
                      {item.title}
                    </div>
                    {item.detail && (
                      <div className="pipe-event-detail">{item.detail}</div>
                    )}
                  </div>

                  <div className="pipe-event-meta">
                    <span className="pipe-event-label">{meta.label}</span>
                    <span className="pipe-event-service">{item.serviceLabel}</span>
                    <span className="pipe-event-time">{relativeTime(item.time)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
