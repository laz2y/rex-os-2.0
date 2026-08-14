import "./Diagnostics.css";

import { useCallback, useEffect, useState } from "react";
import {
  Activity as ActivityIcon,
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Cpu,
  Database,
  HardDrive,
  Network,
  RefreshCw,
  ShieldCheck,
  Workflow,
  XCircle,
} from "lucide-react";

import { getDiagnostics } from "../api/diagnostics";

const STATUS_META = {
  PASS: { label: "PASS", icon: CheckCircle2, cls: "ok" },
  WARNING: { label: "WARNING", icon: AlertTriangle, cls: "warn" },
  CRITICAL: { label: "CRITICAL", icon: XCircle, cls: "bad" },
  FAIL: { label: "FAIL", icon: XCircle, cls: "bad" },
};

function StatusChip({ status }) {
  const meta = STATUS_META[status] || STATUS_META.FAIL;
  const Icon = meta.icon;
  return (
    <span className={`diag-chip ${meta.cls}`}>
      <Icon size={13} />
      {meta.label}
    </span>
  );
}

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

function relativeTime(iso) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 45000) return "just now";
  if (diff < 3600000) return `${Math.max(1, Math.floor(diff / 60000))}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function Section({ icon: Icon, title, status, children, delay }) {
  return (
    <section className={`diag-section fade-up ${delay ? `d-${delay}` : ""}`}>
      <div className="diag-section-head">
        <div className="diag-section-title">
          <Icon size={18} />
          <h2>{title}</h2>
        </div>
        <StatusChip status={status} />
      </div>
      {children}
    </section>
  );
}

function CheckRow({ name, status, detail }) {
  return (
    <div className="diag-check">
      <span className={`diag-dot ${(STATUS_META[status] || STATUS_META.FAIL).cls}`} />
      <strong>{name}</strong>
      <span className="diag-check-detail">{detail}</span>
      <StatusChip status={status} />
    </div>
  );
}

export default function Diagnostics() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDiagnostics();
      setReport(data);
    } catch (err) {
      console.error("[REX OS] diagnostics failed:", err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const summary = report?.summary || {};
  const sections = report?.sections || {};
  const storage = sections.storage || {};
  const services = sections.services?.services || [];
  const pipeline = report?.pipeline?.pipeline || {};

  return (
    <div className="page">
      <div className="page-head fade-up">
        <h1>Diagnostics</h1>
        <p>Full NAS health report — every check runs live against the real services</p>
      </div>

      {/* Summary chips */}
      <section className="diag-summary fade-up d-1">
        {[
          ["System", summary.system, Cpu],
          ["Docker", summary.docker, Boxes],
          ["Services", summary.services, ActivityIcon],
          ["Network", summary.network, Network],
          ["Storage", summary.storage, HardDrive],
          ["Pipeline", summary.pipeline, Workflow],
        ].map(([label, status, Icon]) => {
          const meta = STATUS_META[status] || STATUS_META.FAIL;
          return (
            <div key={label} className={`diag-summary-item ${meta.cls}`}>
              <Icon size={18} />
              <span>{label}</span>
              <strong>{meta.label}</strong>
            </div>
          );
        })}

        <button
          type="button"
          className="refresh-btn"
          onClick={load}
          disabled={loading}
        >
          <RefreshCw size={15} className={loading ? "spin" : ""} />
          {loading ? "Running…" : "Run diagnostics"}
        </button>
      </section>

      {loading && !report ? (
        <div className="diag-skeleton" aria-busy="true">
          <div className="skeleton sk-line" />
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
            <h3>Diagnostics unavailable</h3>
            <p>Could not reach the REX backend. Make sure the API is running.</p>
          </div>
          <button type="button" className="retry-btn" onClick={load}>
            <RefreshCw size={16} />
            Retry
          </button>
        </div>
      ) : report ? (
        <>
          {report.runAt && (
            <p className="diag-timestamp fade-up d-2">
              Report generated {relativeTime(report.runAt)} · {report.durationMs}ms
            </p>
          )}

          <Section icon={Cpu} title="System" status={summary.system} delay={2}>
            {(sections.system?.checks || []).map((check) => (
              <CheckRow key={check.name} {...check} />
            ))}
          </Section>

          <Section icon={Boxes} title="Docker" status={summary.docker} delay={2}>
            {(sections.docker?.checks || []).map((check) => (
              <CheckRow key={check.name} {...check} />
            ))}
            {sections.docker?.counts && (
              <p className="diag-note">
                {sections.docker.counts.running} running · {sections.docker.counts.stopped} stopped ·{" "}
                {sections.docker.counts.total} total
              </p>
            )}
          </Section>

          <Section icon={ActivityIcon} title="Services" status={summary.services} delay={3}>
            <div className="diag-services">
              {services.map((service) => {
                const status = STATUS_META[service.status] ? service.status : "FAIL";
                const meta = STATUS_META[status];
                const Icon = meta.icon;
                return (
                  <div key={service.id} className={`diag-service ${meta.cls}`}>
                    <Icon size={15} />
                    <strong>{service.name}</strong>
                    <span className="diag-check-detail">{service.detail}</span>
                    {service.ms != null && <em>{service.ms}ms</em>}
                    <StatusChip status={status} />
                  </div>
                );
              })}
            </div>
          </Section>

          <Section icon={Network} title="Network" status={summary.network} delay={3}>
            {(sections.network?.checks || []).map((check) => (
              <CheckRow key={check.name} {...check} />
            ))}
          </Section>

          <Section icon={Database} title="Pipeline" status={summary.pipeline} delay={4}>
            <div className="diag-pipeline">
              <div>
                <span>State</span>
                <strong className={`pipe-state ${pipeline.state?.toLowerCase()}`}>
                  {pipeline.state || "—"}
                </strong>
              </div>
              <div>
                <span>Last success</span>
                <strong>{relativeTime(pipeline.lastSuccess)}</strong>
              </div>
              <div>
                <span>Last failure</span>
                <strong>{relativeTime(pipeline.lastFailure)}</strong>
              </div>
              <div>
                <span>Operation</span>
                <strong>{pipeline.operation || "—"}</strong>
              </div>
            </div>
          </Section>

          <Section icon={HardDrive} title="Storage" status={summary.storage} delay={4}>
            {storage.usedPercent != null && (
              <>
                <div className="storage-bar">
                  <div
                    className={`storage-fill ${storage.level?.toLowerCase()}`}
                    style={{ width: `${Math.min(100, storage.usedPercent)}%` }}
                  />
                </div>
                <div className="diag-storage-meta">
                  <span>
                    <strong>{storage.usedPercent}%</strong> used · {formatBytes(storage.used)} of{" "}
                    {formatBytes(storage.total)}
                  </span>
                  <span>{formatBytes(storage.free)} free</span>
                  <span className="diag-thresholds">
                    <ShieldCheck size={13} />
                    threshold {storage.thresholds?.warn ?? 70}% warn / {storage.thresholds?.crit ?? 85}% crit
                  </span>
                </div>
              </>
            )}
          </Section>
        </>
      ) : null}
    </div>
  );
}
