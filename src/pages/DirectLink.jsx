import "./DirectLink.css";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Link2,
  Loader2,
  PackageOpen,
  RefreshCw,
  XCircle,
} from "lucide-react";

import {
  addDirectLink,
  getPyLoadInfo,
  getPyLoadStatus,
} from "../services/pyLoadService";

const POLL_MS = 5000;

/** Format helpers — pyLoad returns raw bytes / bytes-per-second / seconds. */
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
  if (value == null || !Number.isFinite(value)) return "—";
  if (value <= 0) return "done";
  if (value < 60) return `${Math.round(value)}s`;
  if (value < 3600) return `${Math.floor(value / 60)}m ${Math.round(value % 60)}s`;
  const hours = Math.floor(value / 3600);
  return `${hours}h ${Math.floor((value % 3600) / 60)}m`;
}

function statusLabel(state, status) {
  switch (state) {
    case "finished":
      return "Finished";
    case "downloading":
      return "Downloading";
    case "failed":
      return "Failed";
    case "paused":
      return "Paused";
    case "queued":
      return "Queued";
    case "waiting":
      return "Waiting";
    case "processing":
      return "Processing";
    default:
      return String(status || "Active");
  }
}

/** A pyLoad download row (name, status badge, progress bar, stats). */
function DownloadRow({ item, url }) {
  const state = item?.state || (url ? "queued" : "active");

  return (
    <div className={`dl-row state-${state}`}>
      <div className="dl-main">
        <div className="dl-name" title={item?.name || url}>
          {item?.name || "Resolving file name…"}
        </div>

        {url && (
          <div className="dl-url" title={url}>
            {url}
          </div>
        )}

        <div className="dl-meta">
          <span className={`dl-badge ${state}`}>
            {state === "downloading" && <Loader2 size={11} className="spin" />}
            {statusLabel(state, item?.status)}
          </span>

          {item?.progress != null && (
            <span className="dl-percent">{Math.round(item.progress)}%</span>
          )}
        </div>
      </div>

      {item?.progress != null && (
        <div
          className="dl-progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(item.progress)}
        >
          <div className="dl-progress-fill" style={{ width: `${Math.min(100, Math.max(0, item.progress))}%` }} />
        </div>
      )}

      <div className="dl-stats">
        <span title="Size">
          <strong>{formatBytes(item?.size)}</strong> size
        </span>
        <span title="Speed">
          <strong>{formatSpeed(item?.speed)}</strong> speed
        </span>
        <span title="ETA">
          <strong>{formatEta(item?.eta)}</strong> eta
        </span>
      </div>
    </div>
  );
}

function StatusSkeleton() {
  return (
    <div className="dl-row skeleton-row" aria-busy="true">
      <div className="skeleton sk-title" />
      <div className="skeleton sk-sub" />
      <div className="skeleton sk-line" />
    </div>
  );
}

export default function DirectLink() {
  const [url, setUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState(null);
  const [lastAdded, setLastAdded] = useState(null); // { url, packageId, packageName }
  const addedRef = useRef([]);

  const [downloads, setDownloads] = useState([]);
  const [statusError, setStatusError] = useState(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [pyLoadUrl, setPyLoadUrl] = useState(null);

  // Resolve the pyLoad web UI URL (server-configured, never hard-coded).
  useEffect(() => {
    getPyLoadInfo()
      .then((data) => {
        if (data && data.url) setPyLoadUrl(data.url);
      })
      .catch(() => {
        /* status polling surfaces connectivity separately */
      });
  }, []);

  /** Poll pyLoad status (pauses while the tab is hidden). */
  const refreshStatus = useCallback(async () => {
    try {
      const list = await getPyLoadStatus();
      setDownloads(list);
      setStatusError(null);
    } catch (err) {
      console.error("[REX OS] pyLoad status failed:", err);
      setStatusError(err);
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
    const timer = setInterval(() => {
      if (!document.hidden) refreshStatus();
    }, POLL_MS);

    function onVisible() {
      if (!document.hidden) refreshStatus();
    }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refreshStatus, reload]);

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError(null);

    const trimmed = url.trim();

    if (!trimmed) {
      setFormError("Enter a download URL first.");
      return;
    }

    try {
      new URL(trimmed);
    } catch {
      setFormError("That doesn't look like a valid URL.");
      return;
    }

    // Session-level duplicate guard — avoids spamming pyLoad with the same link.
    if (addedRef.current.some((item) => item.url === trimmed)) {
      setFormError("This URL is already in your download list.");
      return;
    }

    setAdding(true);

    try {
      const data = await addDirectLink(trimmed);
      const added = {
        url: trimmed,
        packageId: data.packageId ?? null,
        packageName: data.packageName || trimmed,
      };
      addedRef.current = [added, ...addedRef.current];
      setLastAdded(added);
      setUrl("");
      setStatusLoading(true);
      refreshStatus();
    } catch (err) {
      console.error("[REX OS] add direct link failed:", err);
      setFormError(
        err?.response?.data?.error ||
          err.message ||
          "Failed to add the download. Try again.",
      );
    } finally {
      setAdding(false);
    }
  }

  /**
   * Merge our session adds (with their URLs) with the full pyLoad queue:
   * match by package id first, then by package name; queue rows that aren't
   * from this session are still shown so the whole download state is visible.
   */
  const rows = useMemo(() => {
    const byId = new Map();
    const byName = new Map();
    for (const download of downloads) {
      if (download.packageId != null) byId.set(String(download.packageId), download);
      if (download.package) byName.set(String(download.package), download);
    }

    const seen = new Set();
    const list = [];

    for (const added of addedRef.current) {
      const match =
        (added.packageId != null && byId.get(String(added.packageId))) ||
        byName.get(String(added.packageName || ""));
      seen.add(String(match ? match.fid : `a-${added.url}`));
      list.push({ key: `a-${added.url}`, url: added.url, download: match || null });
    }

    for (const download of downloads) {
      const key = String(download.fid);
      if (seen.has(key)) continue;
      seen.add(key);
      list.push({ key: `d-${key}`, url: null, download });
    }

    return list;
  }, [downloads]);

  const pendingAdds = rows.filter((row) => row.url && !row.download);

  return (
    <div className="page">
      <div className="page-head fade-up">
        <h1>Direct Link Add</h1>
        <p>Feed a direct download URL into pyLoad — everything else is automatic</p>
      </div>

      {/* Add a link */}
      <section className="dl-card fade-up d-1">
        <div className="dl-card-head">
          <div className="dl-card-icon">
            <Link2 size={22} />
          </div>
          <div>
            <h2>Add a Download</h2>
            <p>
              Paste one direct link. pyLoad resolves the filename, folder and
              destination — REX never renames anything.
            </p>
          </div>
        </div>

        <form className="dl-form" onSubmit={handleSubmit}>
          <label className="dl-input">
            <Link2 size={18} />
            <input
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com/file"
              aria-label="Direct download URL"
              autoComplete="off"
              spellCheck="false"
              disabled={adding}
              autoFocus
            />
          </label>

          <button type="submit" className="dl-submit" disabled={adding}>
            {adding ? (
              <>
                <Loader2 size={17} className="spin" />
                Adding download…
              </>
            ) : (
              <>
                <PackageOpen size={17} />
                Add Download
              </>
            )}
          </button>
        </form>

        {formError && (
          <div className="dl-alert error" role="alert">
            <XCircle size={16} />
            {formError}
          </div>
        )}

        {lastAdded && !adding && (
          <div className="dl-alert success" role="status">
            <CheckCircle2 size={16} />
            <div>
              <strong>✓ Download added</strong>
              <span>
                {lastAdded.packageName
                  ? `${lastAdded.packageName} — queued in pyLoad.`
                  : "Queued in pyLoad."}
              </span>
            </div>
          </div>
        )}
      </section>

      {/* Status */}
      <section className="dl-card fade-up d-2">
        <div className="dl-status-head">
          <div className="dl-card-head">
            <div className="dl-card-icon alt">
              <PackageOpen size={20} />
            </div>
            <div>
              <h2>Download Status</h2>
              <p>
                Live status from pyLoad — name, progress, size, speed and ETA.
              </p>
            </div>
          </div>

          <button
            type="button"
            className="refresh-btn"
            onClick={() => {
              setStatusLoading(true);
              setReload((value) => value + 1);
            }}
            disabled={statusLoading}
            aria-label="Refresh status"
          >
            <RefreshCw size={15} className={statusLoading ? "spin" : ""} />
            Refresh
          </button>
        </div>

        {statusLoading && downloads.length === 0 ? (
          <div aria-busy="true">
            <StatusSkeleton />
            <StatusSkeleton />
          </div>
        ) : statusError ? (
          <div className="error-card">
            <div className="error-icon">
              <AlertTriangle size={20} />
            </div>

            <div className="error-body">
              <h3>pyLoad is unreachable</h3>
              <p>
                Could not read the download status from pyLoad. Make sure it is
                running and the server credentials are configured.
              </p>
            </div>

            <button
              type="button"
              className="retry-btn"
              onClick={() => {
                setStatusLoading(true);
                setReload((value) => value + 1);
              }}
            >
              <RefreshCw size={15} />
              Retry
            </button>
          </div>
        ) : rows.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <PackageOpen size={24} />
            </div>
            <h3>No active downloads</h3>
            <p>
              Paste a direct link above and pyLoad will start it — status
              appears here automatically.
            </p>
          </div>
        ) : (
          <div className="dl-list">
            {pendingAdds.length > 0 && (
              <p className="dl-checking">
                <Loader2 size={14} className="spin" />
                Checking status…
              </p>
            )}

            {rows.map((row) => (
              <DownloadRow
                key={row.key}
                item={row.download}
                url={row.url}
              />
            ))}
          </div>
        )}

        <p className="dl-foot">
          Filenames are decided by pyLoad — REX only hands over the link. The
          existing pyLoad → Radarr/Sonarr importer handles everything downstream.
        </p>
      </section>

      {/* Open pyLoad (only when the server knows its URL) */}
      {pyLoadUrl && (
        <div className="dl-open fade-up d-3">
          <span>
            <ExternalLink size={15} />
            Want the full queue view?
          </span>
          <a href={pyLoadUrl} target="_blank" rel="noreferrer">
            Open pyLoad
          </a>
        </div>
      )}
    </div>
  );
}
