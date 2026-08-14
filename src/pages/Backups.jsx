import "./Backups.css";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  Database,
  History,
  Info,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
} from "lucide-react";

import {
  getBackups,
  createBackup,
  restoreBackup,
  deleteBackup,
} from "../services/backupService";
import { success as toastSuccess, error as toastError } from "../services/toastService";

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

function formatDate(iso) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Backups() {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [confirm, setConfirm] = useState(null); // { type: "restore"|"delete", backup }
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await getBackups();
      setBackups(data.backups || []);
      setError(null);
    } catch (err) {
      console.error("[REX OS] backups load failed:", err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate() {
    setCreating(true);
    try {
      const data = await createBackup();
      toastSuccess("Backup created");
      setBackups((prev) => [data.backup, ...prev]);
    } catch (err) {
      toastError(err?.response?.data?.error || "Backup failed");
    } finally {
      setCreating(false);
    }
  }

  async function doAction() {
    if (!confirm) return;
    setBusyId(confirm.backup.id);
    try {
      if (confirm.type === "restore") {
        await restoreBackup(confirm.backup.id);
        toastSuccess("REX state restored — reloading…");
      } else {
        await deleteBackup(confirm.backup.id);
        toastSuccess("Backup deleted");
        setBackups((prev) => prev.filter((b) => b.id !== confirm.backup.id));
      }
      setConfirm(null);
      await load();
    } catch (err) {
      toastError(err?.response?.data?.error || "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  const totalBytes = useMemo(
    () => backups.reduce((sum, b) => sum + (b.bytes || 0), 0),
    [backups],
  );
  const lastBackup = backups[0]?.createdAt || null;
  const autoCount = backups.filter((b) => b.type === "auto").length;

  const statCards = [
    { label: "Total backups", value: backups.length, icon: Archive, color: "var(--primary)" },
    { label: "Total size", value: formatBytes(totalBytes), icon: Database, color: "#06b6d4" },
    {
      label: "Last backup",
      value: lastBackup ? new Date(lastBackup).toLocaleDateString([], { month: "short", day: "numeric" }) : "None",
      icon: History,
      color: "#22c55e",
    },
    { label: "Automatic", value: autoCount, icon: RefreshCw, color: "#f59e0b" },
  ];

  return (
    <div className="page">
      <div className="page-head fade-up">
        <h1>Backups</h1>
        <p>Protect REX OS state — manual or scheduled snapshots with restore</p>

        <button
          type="button"
          className="bk-create"
          onClick={handleCreate}
          disabled={creating}
        >
          {creating ? <Loader2 size={16} className="spin" /> : <Plus size={16} />}
          {creating ? "Creating…" : "Create Backup"}
        </button>
      </div>

      <div className="bk-summary fade-up d-1">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div className="summary-chip" key={stat.label}>
              <div className="chip-icon" style={{ background: stat.color, boxShadow: `0 10px 24px ${stat.color}55` }}>
                <Icon size={22} />
              </div>
              <div>
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="offline-strip fade-up">
          <span>Backups unavailable — could not reach the REX API</span>
          <button type="button" onClick={load}>
            <RefreshCw size={13} />
            Retry
          </button>
        </div>
      )}

      <section className="bk-card fade-up d-2">
        <div className="bk-card-head">
          <h2>
            <Archive size={18} />
            Backup History
          </h2>
          <button type="button" className="refresh-btn" onClick={load} disabled={loading}>
            <RefreshCw size={15} className={loading ? "spin" : ""} />
            Refresh
          </button>
        </div>

        {loading && backups.length === 0 ? (
          <div aria-busy="true">
            <div className="skeleton sk-line" />
            <div className="skeleton sk-line" />
            <div className="skeleton sk-line" />
          </div>
        ) : backups.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <Archive size={24} />
            </div>
            <h3>No backups yet</h3>
            <p>Create your first backup above — REX state (activity, notifications, pipeline, recovery, update state) is archived to backend/data/backups.</p>
          </div>
        ) : (
          <div className="bk-list">
            {backups.map((backup) => (
              <div className="bk-row" key={backup.id}>
                <div className={`bk-row-icon ${backup.type}`}>
                  <Archive size={18} />
                </div>

                <div className="bk-row-body">
                  <strong>
                    {backup.id}
                    {backup.type === "auto" && <em className="bk-auto-tag">automatic</em>}
                  </strong>
                  <span>
                    {formatDate(backup.createdAt)} · v{backup.version} · {formatBytes(backup.bytes)}
                  </span>
                  {backup.contents?.length > 0 && (
                    <span className="bk-contents">
                      {backup.contents.slice(0, 6).map((name) => name.split("/").pop()).filter(Boolean).join(" · ")}
                      {backup.contents.length > 6 ? " · …" : ""}
                    </span>
                  )}
                </div>

                <div className="bk-row-actions">
                  <button
                    type="button"
                    className="row-action"
                    title="Restore this backup"
                    aria-label={`Restore ${backup.id}`}
                    disabled={busyId === backup.id}
                    onClick={() => setConfirm({ type: "restore", backup })}
                  >
                    <RotateCcw size={15} />
                  </button>
                  <button
                    type="button"
                    className="row-action danger"
                    title="Delete this backup"
                    aria-label={`Delete ${backup.id}`}
                    disabled={busyId === backup.id}
                    onClick={() => setConfirm({ type: "delete", backup })}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bk-card fade-up d-3">
        <div className="bk-card-head">
          <h2>
            <Info size={18} />
            What gets backed up
          </h2>
        </div>
        <div className="bk-info-grid">
          <div>
            <strong>Included</strong>
            <ul>
              <li>Activity log</li>
              <li>Notifications</li>
              <li>Pipeline state</li>
              <li>Recovery state</li>
              <li>Update state & history</li>
              <li>REX OS version marker</li>
            </ul>
          </div>
          <div>
            <strong>Never included</strong>
            <ul>
              <li>Media libraries (Jellyfin / Radarr / Sonarr data stays where it is)</li>
              <li>Passwords or API keys (backend/.env, .auth-secrets.json)</li>
              <li>node_modules or build caches</li>
            </ul>
          </div>
          <div>
            <strong>Scheduling</strong>
            <ul>
              <li>Automatic backups run once per day by default (REX_BACKUP_INTERVAL, minimum 1h)</li>
              <li>Backups live in backend/data/backups — mount backend/data as a persistent volume</li>
            </ul>
          </div>
        </div>
      </section>

      {confirm && (
        <div className="modal-overlay" onClick={() => !busyId && setConfirm(null)}>
          <div
            className="modal-card"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="bk-confirm-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-icon">
              {confirm.type === "restore" ? <RotateCcw size={20} /> : <Trash2 size={20} />}
            </div>
            <h3 id="bk-confirm-title">
              {confirm.type === "restore" ? "Restore this backup?" : "Delete this backup?"}
            </h3>
            <p className="modal-name">{confirm.backup.id}</p>
            <p className="modal-hint">
              {confirm.type === "restore"
                ? "REX OS state (activity, notifications, pipeline, recovery, update state) will be replaced with the snapshot from this backup. Current state is not saved first — create a fresh backup if you want to keep it."
                : "The backup archive will be permanently removed. This cannot be undone."}
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="modal-btn cancel"
                onClick={() => setConfirm(null)}
                disabled={busyId != null}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`modal-btn ${confirm.type === "restore" ? "" : "danger"}`}
                onClick={doAction}
                disabled={busyId != null}
              >
                {busyId ? <Loader2 size={15} className="spin" /> : confirm.type === "restore" ? <RotateCcw size={15} /> : <Trash2 size={15} />}
                {confirm.type === "restore" ? "Restore" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
