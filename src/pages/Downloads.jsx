import "./Downloads.css";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Download,
  ExternalLink,
  Loader2,
  Magnet,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";

import {
  addTorrent,
  getQbittorrentOverview,
  pauseTorrent,
  removeTorrent,
  resumeTorrent,
} from "../services/qBittorrentService";
import { error as toastError, success } from "../services/toastService";
import { services } from "../data/services";

const POLL_MS = 5000;

/** Format helpers — qBittorrent returns raw bytes / bytes-per-second / seconds. */
function formatBytes(value) {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size >= 100 || unit === 0 ? Math.round(size) : size.toFixed(1)} ${units[unit]}`;
}

function formatSpeed(value) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${formatBytes(value)}/s`;
}

function formatEta(value) {
  // qBittorrent uses -1 for "no ETA" (e.g. seeding torrents).
  if (value == null || !Number.isFinite(value) || value < 0) return "—";
  if (value === 0) return "done";
  if (value < 60) return `${Math.round(value)}s`;
  if (value < 3600) return `${Math.floor(value / 60)}m ${Math.round(value % 60)}s`;
  const hours = Math.floor(value / 3600);
  return `${hours}h ${Math.floor((value % 3600) / 60)}m`;
}

function formatRatio(value) {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(2);
}

const STATE_LABELS = {
  downloading: "Downloading",
  forcedDL: "Downloading",
  uploading: "Seeding",
  forcedUP: "Seeding",
  pausedDL: "Paused",
  pausedUP: "Paused",
  queuedDL: "Queued",
  queuedUP: "Queued",
  checkingDL: "Checking",
  checkingUP: "Checking",
  allocating: "Allocating",
  moving: "Moving",
  stalledDL: "Stalled",
  stalledUP: "Stalled",
  metaDL: "Fetching metadata",
  error: "Error",
  missingFiles: "Missing files",
};

function stateLabel(raw) {
  if (STATE_LABELS[raw]) return STATE_LABELS[raw];
  return String(raw || "unknown")
    .replace(/^./, (char) => char.toUpperCase())
    .replace(/([A-Z])/g, " $1")
    .trim();
}

/** Show paused/error torrents last; keep everything else grouped naturally. */
const STATUS_ORDER = {
  downloading: 0,
  metadata: 1,
  checking: 2,
  queued: 3,
  stalled: 4,
  seeding: 5,
  paused: 6,
  error: 7,
  missing: 8,
  unknown: 9,
};

function TorrentRow({ torrent, isBusy, onAction }) {
  const progress = torrent.progress ?? 0;
  const canPause = !["paused", "error", "missing", "unknown"].includes(
    torrent.status,
  );

  return (
    <div className={`qb-row state-${torrent.status}`}>
      <div className="qb-row-main">
        <div className="qb-name">
          <div className="qb-row-icon">
            <Download size={17} />
          </div>
          <div className="qb-name-text">
            <h4 title={torrent.name}>{torrent.name}</h4>
            <span title={torrent.tracker || torrent.savePath}>
              {torrent.tracker || torrent.savePath || "No tracker"}
            </span>
          </div>
        </div>

        <div
          className="qb-progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
        >
          <div
            className="qb-progress-fill"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>

        <div className="qb-progress-meta">
          <span>{Math.round(progress)}%</span>
          <span>
            {formatBytes(torrent.downloaded)} / {formatBytes(torrent.size)}
          </span>
        </div>
      </div>

      <div className="qb-meta">
        <span className={`qb-badge ${torrent.status}`}>
          {torrent.status === "downloading" && (
            <Loader2 size={11} className="spin" />
          )}
          {stateLabel(torrent.state)}
        </span>

        <div className="qb-stats">
          <span title="Download speed">
            ↓ {formatSpeed(torrent.downloadSpeed)}
          </span>
          <span title="Upload speed">↑ {formatSpeed(torrent.uploadSpeed)}</span>
          <span title="Ratio">ratio {formatRatio(torrent.ratio)}</span>
          <span title="ETA">{torrent.status === "downloading" || torrent.status === "metadata" ? formatEta(torrent.eta) : "—"}</span>
          <span title="Seeds / peers">
            {torrent.seeds ?? "—"} / {torrent.peers ?? "—"} peers
          </span>
        </div>
      </div>

      <div className="qb-actions">
        {torrent.status === "paused" ? (
          <button
            type="button"
            className="qb-row-action"
            aria-label={`Resume ${torrent.name}`}
            title="Resume"
            disabled={isBusy}
            onClick={() => onAction("resume", torrent)}
          >
            <Play size={15} />
          </button>
        ) : canPause ? (
          <button
            type="button"
            className="qb-row-action"
            aria-label={`Pause ${torrent.name}`}
            title="Pause"
            disabled={isBusy}
            onClick={() => onAction("pause", torrent)}
          >
            <Pause size={15} />
          </button>
        ) : null}

        <button
          type="button"
          className="qb-row-action danger"
          aria-label={`Delete ${torrent.name}`}
          title="Delete"
          disabled={isBusy}
          onClick={() => onAction("delete", torrent)}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}

function RowSkeleton() {
  return (
    <div className="qb-row skeleton-row" aria-busy="true">
      <div className="qb-row-main">
        <div className="skeleton sk-title" />
        <div className="skeleton sk-sub" />
        <div className="skeleton sk-line" />
      </div>
      <div className="qb-meta">
        <div className="skeleton sk-sub" />
      </div>
    </div>
  );
}

export default function Downloads() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(() => new Set());

  const [url, setUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState(null);
  const [lastAdded, setLastAdded] = useState(null);

  const qb = services.find((service) => service.id === "qbittorrent");

  const load = useCallback(async () => {
    try {
      const result = await getQbittorrentOverview();
      setData(result);
      setError(null);
    } catch (err) {
      console.error("[REX OS] qbittorrent load failed:", err);
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

  const torrents = useMemo(() => {
    const list = data?.torrents || [];
    return [...list].sort(
      (a, b) =>
        (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9),
    );
  }, [data]);

  const downloading = torrents.filter((t) => t.status === "downloading").length;
  const seeding = torrents.filter((t) => t.status === "seeding").length;
  const transfer = data?.transfer || {};

  function markBusy(hash) {
    setBusy((prev) => {
      const next = new Set(prev);
      next.add(hash);
      return next;
    });
  }

  function unmarkBusy(hash) {
    setBusy((prev) => {
      const next = new Set(prev);
      next.delete(hash);
      return next;
    });
  }

  async function runAction(action, torrent) {
    if (action === "delete") {
      const ok = window.confirm(
        `Remove "${torrent.name}" from qBittorrent and delete its downloaded files?`,
      );
      if (!ok) return;
    }

    markBusy(torrent.hash);

    try {
      if (action === "pause") await pauseTorrent(torrent.hash);
      if (action === "resume") await resumeTorrent(torrent.hash);
      if (action === "delete") await removeTorrent(torrent.hash, true);

      success(
        `${torrent.name} ${
          action === "delete"
            ? "removed"
            : action === "pause"
            ? "paused"
            : "resumed"
        }`,
      );
      await load();
    } catch (err) {
      console.error(err);
      toastError("Action failed");
    } finally {
      unmarkBusy(torrent.hash);
    }
  }

  function refresh() {
    setLoading(true);
    setReload((value) => value + 1);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError(null);

    const trimmed = url.trim();

    if (!trimmed) {
      setFormError("Enter a download link first.");
      return;
    }

    if (!/^https?:\/\//i.test(trimmed) && !/^magnet:\?/i.test(trimmed)) {
      setFormError("Use an http(s) link or a magnet link.");
      return;
    }

    setAdding(true);

    try {
      await addTorrent(trimmed);
      setLastAdded(trimmed);
      setUrl("");
      refresh();
    } catch (err) {
      console.error("[REX OS] add torrent failed:", err);
      setFormError(
        err?.response?.data?.error ||
          err.message ||
          "Failed to add the torrent. Try again.",
      );
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="page">
      <div className="page-head fade-up">
        <h1>Downloads</h1>
        <p>qBittorrent — torrents, speeds and seeding at a glance</p>
      </div>

      {/* Summary */}
      <div className="qb-summary fade-up d-1">
        <div className="qb-chip">
          <div className="qb-chip-icon down">
            <Download size={21} />
          </div>
          <div>
            <strong>{downloading}</strong>
            <span>Downloading</span>
          </div>
        </div>

        <div className="qb-chip">
          <div className="qb-chip-icon up">
            <Upload size={21} />
          </div>
          <div>
            <strong>{seeding}</strong>
            <span>Seeding</span>
          </div>
        </div>

        <div className="qb-chip">
          <div className="qb-chip-icon speed">
            <ArrowDown size={21} />
          </div>
          <div>
            <strong>{formatSpeed(transfer.downloadSpeed)}</strong>
            <span>Down speed</span>
          </div>
        </div>

        <div className="qb-chip">
          <div className="qb-chip-icon upspeed">
            <ArrowUp size={21} />
          </div>
          <div>
            <strong>{formatSpeed(transfer.uploadSpeed)}</strong>
            <span>Up speed</span>
          </div>
        </div>
      </div>

      {/* Add a torrent */}
      <section className="qb-card fade-up d-2">
        <div className="qb-card-head">
          <div className="qb-card-icon">
            <Magnet size={22} />
          </div>
          <div>
            <h2>Add a Torrent</h2>
            <p>
              Paste a magnet link or an http(s) link to a .torrent file.
              qBittorrent manages the filename, category and destination.
            </p>
          </div>
        </div>

        <form className="qb-form" onSubmit={handleSubmit}>
          <label className="qb-input">
            <Magnet size={18} />
            <input
              type="text"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="magnet:?xt=urn:btih:… or https://example.com/file.torrent"
              aria-label="Torrent link"
              autoComplete="off"
              spellCheck="false"
              disabled={adding}
            />
          </label>

          <button type="submit" className="qb-submit" disabled={adding}>
            {adding ? (
              <>
                <Loader2 size={17} className="spin" />
                Adding torrent…
              </>
            ) : (
              <>
                <Plus size={17} />
                Add Torrent
              </>
            )}
          </button>
        </form>

        {formError && (
          <div className="qb-alert error" role="alert">
            <XCircle size={16} />
            {formError}
          </div>
        )}

        {lastAdded && !adding && !formError && (
          <div className="qb-alert success" role="status">
            <CheckCircle2 size={16} />
            <div>
              <strong>✓ Torrent added</strong>
              <span>{lastAdded}</span>
            </div>
          </div>
        )}
      </section>

      {/* Torrent list */}
      <section className="qb-table fade-up d-3">
        <div className="qb-table-header">
          <div>
            <h2>Torrents</h2>
            {data?.version && (
              <span className="qb-version">qBittorrent {data.version}</span>
            )}
          </div>

          <div className="qb-table-actions">
            {qb && (
              <a
                className="widget-link"
                href={qb.url}
                target="_blank"
                rel="noreferrer"
              >
                Open qBittorrent
                <ExternalLink size={14} />
              </a>
            )}

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
        </div>

        {!loading && !error && torrents.length > 0 && (
          <div className="qb-colhead" aria-hidden="true">
            <span>Torrent</span>
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
              <AlertTriangle size={20} />
            </div>

            <div className="error-body">
              <h3>qBittorrent is unreachable</h3>
              <p>
                Could not read the torrent list from qBittorrent. Make sure it
                is running and the server credentials are configured.
              </p>
            </div>

            <button type="button" className="retry-btn" onClick={refresh}>
              <RefreshCw size={16} />
              Retry
            </button>
          </div>
        ) : torrents.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <Download size={24} />
            </div>
            <h3>No torrents in the queue</h3>
            <p>
              Add a magnet or .torrent link above and it will appear here with
              live progress, speeds and seeding stats.
            </p>
          </div>
        ) : (
          <div>
            {torrents.map((torrent) => (
              <TorrentRow
                key={torrent.hash}
                torrent={torrent}
                isBusy={busy.has(torrent.hash)}
                onAction={runAction}
              />
            ))}
          </div>
        )}

        <p className="qb-foot">
          Filenames, categories and save paths are managed by qBittorrent —
          REX only forwards links and mirrors the queue.
        </p>
      </section>
    </div>
  );
}
