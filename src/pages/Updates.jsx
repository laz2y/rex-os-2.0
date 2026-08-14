import "./Updates.css";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileArchive,
  Loader2,
  PackageCheck,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  UploadCloud,
  XCircle,
} from "lucide-react";

import {
  getUpdateStatus,
  uploadUpdatePackage,
  validateUpdate,
  prepareUpdate,
  installUpdate,
  rollbackUpdate,
} from "../services/updateService";
import { success as toastSuccess, error as toastError } from "../services/toastService";

const STATE_META = {
  idle: { label: "Idle", cls: "idle" },
  uploaded: { label: "Uploaded", cls: "uploaded" },
  validated: { label: "Validated", cls: "ok" },
  prepared: { label: "Rollback point ready", cls: "ok" },
  installing: { label: "Installing", cls: "busy" },
  installed: { label: "Installed — restart required", cls: "ok" },
  rolled_back: { label: "Rolled back", cls: "warn" },
  failed: { label: "Failed", cls: "bad" },
  invalid: { label: "Invalid package", cls: "bad" },
};

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
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Updates() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null); // which step is running
  const [confirmRollback, setConfirmRollback] = useState(null);
  const [rollbackBusy, setRollbackBusy] = useState(false);
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const data = await getUpdateStatus();
      setStatus(data);
    } catch (err) {
      console.error("[REX OS] update status failed:", err);
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleUpload(file) {
    if (!file) return;
    if (!/^rexos-\d+\.\d+\.\d+(-[a-z0-9]+)?-release\.tar\.gz$/.test(file.name)) {
      toastError("Filename must match rexos-<version>-release.tar.gz");
      return;
    }
    setBusy("upload");
    try {
      const result = await uploadUpdatePackage(file);
      toastSuccess(`Uploaded ${result.package.filename}`);
      await load();
    } catch (err) {
      toastError(err?.response?.data?.error || "Upload failed");
    } finally {
      setBusy(null);
    }
  }

  async function runStep(step) {
    setBusy(step);
    try {
      let result;
      if (step === "validate") result = await validateUpdate();
      if (step === "prepare") result = await prepareUpdate();
      if (step === "install") result = await installUpdate();

      if (step === "install") {
        toastSuccess(
          `Release ${status?.stagedVersion || ""} staged and verified — restart the container to activate`,
        );
      } else {
        toastSuccess("Done");
      }
      await load();
    } catch (err) {
      toastError(err?.response?.data?.error || "Step failed");
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function doRollback() {
    setRollbackBusy(true);
    try {
      const result = await rollbackUpdate(confirmRollback || null);
      toastSuccess(result.message || "Rollback complete");
      setConfirmRollback(null);
      await load();
    } catch (err) {
      toastError(err?.response?.data?.error || "Rollback failed");
    } finally {
      setRollbackBusy(false);
    }
  }

  const stateMeta = STATE_META[status?.state] || STATE_META.idle;
  const pkg = status?.uploadedPackage;
  const manifest = status?.manifest;
  const history = status?.history || [];
  const rollbackPoints = status?.rollbackPoints || [];

  const steps = [
    { id: "upload", label: "Upload package", done: Boolean(pkg), current: busy === "upload" },
    { id: "validate", label: "Validate", done: Boolean(manifest) || ["validated", "prepared", "installed"].includes(status?.state), current: busy === "validate" },
    { id: "prepare", label: "Rollback point", done: Boolean(status?.rollbackPointId), current: busy === "prepare" },
    { id: "install", label: "Install", done: status?.state === "installed", current: busy === "install" },
  ];

  return (
    <div className="page">
      <div className="page-head fade-up">
        <h1>Updates</h1>
        <p>Safe REX OS upgrades — validate, rollback point, install, history</p>
      </div>

      {/* Current state */}
      <section className="up-card fade-up d-1">
        <div className="up-card-head">
          <h2>Update Status</h2>
          <span className={`up-state ${stateMeta.cls}`}>
            <i /> {stateMeta.label}
          </span>
        </div>

        <div className="up-meta">
          <div>
            <span>Current version</span>
            <strong>v{status?.currentVersion || "—"}</strong>
          </div>
          <div>
            <span>Health check</span>
            <strong style={{ color: status?.health?.ok ? "#22c55e" : "#ef4444" }}>
              {status?.health == null
                ? "Unknown"
                : status.health.ok
                ? `OK · v${status.health.version || ""}`
                : "Unreachable"}
            </strong>
          </div>
          <div>
            <span>Upload limit</span>
            <strong>{status?.maxUploadBytes ? formatBytes(status.maxUploadBytes) : "—"}</strong>
          </div>
          <div>
            <span>Free space</span>
            <strong>{status?.freeSpace != null ? formatBytes(status.freeSpace) : "—"}</strong>
          </div>
        </div>

        {status?.lastError && (
          <div className="up-alert error" role="alert">
            <XCircle size={16} />
            {status.lastError}
          </div>
        )}

        {/* Flow steps */}
        <div className="up-steps">
          {steps.map((step, index) => (
            <div className={`up-step ${step.done ? "done" : ""} ${step.current ? "current" : ""}`} key={step.id}>
              <div className="up-step-icon">
                {step.done ? (
                  <CheckCircle2 size={18} />
                ) : step.current ? (
                  <Loader2 size={18} className="spin" />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>
              <span>{step.label}</span>
            </div>
          ))}
        </div>

        {manifest && (
          <div className="up-manifest">
            <PackageCheck size={15} />
            <span>
              <strong>{manifest.product} {manifest.version}</strong> · {manifest.releaseType} · requires ≥
              {manifest.minimumVersion} {manifest.releaseDate ? ` · ${manifest.releaseDate}` : ""}
            </span>
          </div>
        )}

        {pkg && (
          <div className="up-manifest">
            <FileArchive size={15} />
            <span>
              <strong>{pkg.filename}</strong> · {formatBytes(pkg.bytes)} · uploaded{" "}
              {formatDate(pkg.uploadedAt)}
            </span>
          </div>
        )}
      </section>

      {/* Upload + actions */}
      <section className="up-card fade-up d-2">
        <div className="up-card-head">
          <h2>Release Package</h2>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".gz,application/gzip"
          className="up-file-input"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) handleUpload(file);
            event.target.value = "";
          }}
        />

        <div
          className="up-dropzone"
          role="button"
          tabIndex={0}
          onClick={() => fileRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              fileRef.current?.click();
            }
          }}
        >
          <UploadCloud size={28} />
          <strong>Upload rexos-&lt;version&gt;-release.tar.gz</strong>
          <span>Filename pattern is validated server-side; the package is never extracted until it passes the archive safety checks.</span>
        </div>

        <div className="up-actions">
          <button
            type="button"
            className="up-btn"
            onClick={() => runStep("validate")}
            disabled={!pkg || busy !== null}
          >
            {busy === "validate" ? <Loader2 size={16} className="spin" /> : <PackageCheck size={16} />}
            Validate package
          </button>

          <button
            type="button"
            className="up-btn"
            onClick={() => runStep("prepare")}
            disabled={!manifest || busy !== null}
          >
            {busy === "prepare" ? <Loader2 size={16} className="spin" /> : <ShieldCheck size={16} />}
            Create rollback point
          </button>

          <button
            type="button"
            className="up-btn primary"
            onClick={() => runStep("install")}
            disabled={!status?.rollbackPointId || busy !== null || status?.state === "installed"}
          >
            {busy === "install" ? <Loader2 size={16} className="spin" /> : <UploadCloud size={16} />}
            Install release
          </button>
        </div>

        <div className="up-note">
          <AlertTriangle size={14} />
          <p>
            <strong>How installs work here:</strong> REX validates the release, syntax-checks its
            backend, verifies the frontend build and creates a rollback point of the current state —
            then stages the release. This process cannot restart its own container, so activating
            the new version requires recreating the REX container on the NAS from the staged release
            (see rex-updater/DESIGN.md). Nothing is ever applied without a rollback point.
          </p>
        </div>
      </section>

      {/* Rollback points */}
      <section className="up-card fade-up d-3">
        <div className="up-card-head">
          <h2>Rollback Points</h2>
          {rollbackPoints.length > 0 && <RefreshCw size={15} className="dim" />}
        </div>

        {rollbackPoints.length === 0 ? (
          <p className="up-empty">No rollback points yet — create one before any install.</p>
        ) : (
          <div className="up-list">
            {rollbackPoints.map((point) => (
              <div className="up-row" key={point.id}>
                <div className="up-row-icon">
                  <RotateCcw size={16} />
                </div>
                <div className="up-row-body">
                  <strong>{point.id}</strong>
                  <span>
                    {formatDate(point.createdAt)} · v{point.fromVersion} · {formatBytes(point.bytes)}
                  </span>
                </div>
                <button
                  type="button"
                  className="up-btn sm"
                  onClick={() => setConfirmRollback(point.id)}
                >
                  Restore
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* History */}
      <section className="up-card fade-up d-4">
        <div className="up-card-head">
          <h2>Update History</h2>
        </div>

        {history.length === 0 ? (
          <p className="up-empty">No updates recorded yet.</p>
        ) : (
          <div className="up-history">
            <div className="up-colhead" aria-hidden="true">
              <span>Version</span>
              <span>Result</span>
              <span>Started</span>
              <span>Duration</span>
            </div>
            {history.map((record) => (
              <div className="up-hrow" key={record.id}>
                <strong>
                  {record.version}
                  {record.fromVersion ? <em>from v{record.fromVersion}</em> : null}
                </strong>
                <span className={`up-result ${record.result}`}>
                  {String(record.result).replace(/_/g, " ")}
                </span>
                <span>{formatDate(record.startedAt)}</span>
                <span>{record.durationMs != null ? `${Math.round(record.durationMs / 1000)}s` : "—"}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Rollback confirmation */}
      {confirmRollback && (
        <div className="modal-overlay" onClick={() => !rollbackBusy && setConfirmRollback(null)}>
          <div
            className="modal-card"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="up-rollback-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-icon">
              <RotateCcw size={20} />
            </div>
            <h3 id="up-rollback-title">Restore rollback point?</h3>
            <p className="modal-hint">
              REX state will be restored from <strong>{confirmRollback}</strong>. Activity,
              notifications, pipeline state and update state revert to that snapshot. This cannot be
              undone without creating a new backup first.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="modal-btn cancel"
                onClick={() => setConfirmRollback(null)}
                disabled={rollbackBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="modal-btn danger"
                onClick={doRollback}
                disabled={rollbackBusy}
              >
                {rollbackBusy ? <Loader2 size={15} className="spin" /> : <RotateCcw size={15} />}
                Restore
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
