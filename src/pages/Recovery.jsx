import "./Recovery.css";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  CheckCircle2,
  Clock3,
  HeartPulse,
  LifeBuoy,
  Loader2,
  RotateCcw,
  ShieldAlert,
  Timer,
} from "lucide-react";

import { getRecovery } from "../services/pipelineService";
import { getUpdateStatus, rollbackUpdate } from "../services/updateService";
import { success as toastSuccess, error as toastError } from "../services/toastService";

const SERVICE_STATE_META = {
  healthy: { label: "Healthy", cls: "ok" },
  recovering: { label: "Recovering", cls: "busy" },
  failed: { label: "Failed", cls: "bad" },
  unknown: { label: "Unknown", cls: "na" },
};

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

function relativeTime(iso) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 45000) return "just now";
  if (diff < 3600000) return `${Math.max(1, Math.floor(diff / 60000))}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function Recovery() {
  const [recovery, setRecovery] = useState(null);
  const [update, setUpdate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rollbackBusy, setRollbackBusy] = useState(false);
  const [confirmRollback, setConfirmRollback] = useState(null);

  const load = useCallback(async () => {
    try {
      const [recoveryData, updateData] = await Promise.all([
        getRecovery(),
        getUpdateStatus().catch(() => null),
      ]);
      setRecovery(recoveryData);
      setUpdate(updateData);
    } catch (err) {
      console.error("[REX OS] recovery load failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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

  const services = recovery?.services || [];
  const rollbackPoints = update?.rollbackPoints || [];

  const failed = services.filter((s) => s.state === "failed").length;
  const recovering = services.filter((s) => s.state === "recovering").length;
  const healthy = services.filter((s) => s.state === "healthy").length;

  const statCards = [
    { label: "Monitored services", value: services.length, icon: Activity, color: "var(--primary)" },
    { label: "Healthy", value: healthy, icon: CheckCircle2, color: "#22c55e" },
    { label: "Recovering", value: recovering, icon: HeartPulse, color: "#60a5fa" },
    { label: "Failed", value: failed, icon: ShieldAlert, color: failed ? "#ef4444" : "#64748b" },
  ];

  return (
    <div className="page">
      <div className="page-head fade-up">
        <h1>Recovery</h1>
        <p>Auto-recovery monitor and update rollback points — keep REX running</p>
      </div>

      {/* Auto-recovery status */}
      <div className="rc-summary fade-up d-1">
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

      <section className="rc-card fade-up d-2">
        <div className="rc-card-head">
          <h2>
            <LifeBuoy size={18} />
            Auto-Recovery Monitor
          </h2>

          {recovery && (
            <div className="rc-config">
              <span title="Probe interval">
                <Timer size={13} /> every {Math.round((recovery.monitorMs || 60000) / 1000)}s
              </span>
              <span title="Max attempts per failure window">
                <RotateCcw size={13} /> max {recovery.maxAttempts} attempts
              </span>
              <span title="Cooldown before retrying a failed service">
                <Clock3 size={13} /> {Math.round((recovery.cooldownMs || 600000) / 60000)}m cooldown
              </span>
            </div>
          )}
        </div>

        {loading && services.length === 0 ? (
          <div aria-busy="true">
            <div className="skeleton sk-line" />
            <div className="skeleton sk-line" />
          </div>
        ) : services.length === 0 ? (
          <div className="empty-state compact">
            <div className="empty-icon">
              <LifeBuoy size={24} />
            </div>
            <h3>No services tracked yet</h3>
            <p>
              The monitor probes every configured service in the background and records its state
              here after the first cycle.
            </p>
          </div>
        ) : (
          <div className="rc-services">
            <div className="rc-colhead" aria-hidden="true">
              <span>Service</span>
              <span>State</span>
              <span>Last success</span>
              <span>Last failure</span>
              <span>Container</span>
            </div>
            {services.map((service) => {
              const meta = SERVICE_STATE_META[service.state] || SERVICE_STATE_META.unknown;
              return (
                <div className="rc-service" key={service.id}>
                  <strong>{service.id}</strong>
                  <span className={`rc-state ${meta.cls}`}>
                    <i /> {meta.label}
                  </span>
                  <span>{relativeTime(service.lastSuccessAt)}</span>
                  <span className={service.lastFailureAt ? "fail" : ""}>
                    {relativeTime(service.lastFailureAt)}
                  </span>
                  <span className="rc-container" title={service.container}>
                    {service.container || "—"}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <p className="rc-note">
          <ShieldAlert size={13} />
          Recovery actions (start/restart a failed service's container) require a matching Docker
          container and are always verified by a health probe before being marked successful.
        </p>
      </section>

      {/* Rollback points */}
      <section className="rc-card fade-up d-3">
        <div className="rc-card-head">
          <h2>
            <RotateCcw size={18} />
            Rollback Points
          </h2>
          <span className="rc-hint">
            Created before every update install — restoring keeps the last known-good REX state
          </span>
        </div>

        {rollbackPoints.length === 0 ? (
          <p className="rc-empty">
            No rollback points yet. They are created automatically before an update install.
          </p>
        ) : (
          <div className="rc-rollback-list">
            {rollbackPoints.map((point) => (
              <div className="rc-rollback-row" key={point.id}>
                <div className="rc-rollback-icon">
                  <RotateCcw size={16} />
                </div>
                <div className="rc-rollback-body">
                  <strong>{point.id}</strong>
                  <span>
                    {formatDate(point.createdAt)} · v{point.fromVersion} · {Math.round((point.bytes || 0) / 1048576)} MB
                  </span>
                </div>
                <button
                  type="button"
                  className="rc-restore-btn"
                  onClick={() => setConfirmRollback(point.id)}
                >
                  Restore
                </button>
              </div>
            ))}
          </div>
        )}

        <p className="rc-note">
          <RotateCcw size={13} />
          The known-good version is never deleted before a new release passes validation and health
          checks — rollback restores REX state (activity, notifications, pipeline, recovery, update
          history) from the snapshot taken before the install.
        </p>
      </section>

      {confirmRollback && (
        <div className="modal-overlay" onClick={() => !rollbackBusy && setConfirmRollback(null)}>
          <div
            className="modal-card"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="rc-rollback-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-icon">
              <RotateCcw size={20} />
            </div>
            <h3 id="rc-rollback-title">Restore rollback point?</h3>
            <p className="modal-hint">
              REX OS state will be restored from <strong>{confirmRollback}</strong>. This reverts
              activity, notifications, pipeline, recovery and update state to the pre-update
              snapshot.
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
                {rollbackBusy ? <RotateCcw size={15} className="spin" /> : <RotateCcw size={15} />}
                Restore
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
