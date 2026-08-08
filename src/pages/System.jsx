import "./System.css";

import {
  Activity,
  Cpu,
  Database,
  Gauge as GaugeIcon,
  HardDrive,
  MemoryStick,
  RefreshCw,
  Server,
  Thermometer,
} from "lucide-react";

import useDashboard from "../hooks/useDashboard";

function levelColor(value) {
  if (value == null) return "var(--primary)";
  if (value > 85) return "#ef4444";
  if (value > 70) return "#f59e0b";
  return "var(--primary)";
}

function Gauge({ label, value, icon: Icon, detail }) {
  const color = levelColor(value);
  const pct = Math.max(0, Math.min(100, value ?? 0));

  return (
    <div className="gauge-card fade-up">
      <div
        className="gauge-ring"
        style={{
          background: `conic-gradient(${color} ${pct * 3.6}deg, rgba(255,255,255,0.07) 0deg)`,
        }}
      >
        <div className="gauge-inner">
          <strong>{value == null ? "—" : `${value}%`}</strong>
          <span>{label}</span>
        </div>
      </div>

      <div>
        <div className="gauge-title">
          <Icon size={16} style={{ color }} />
          {label}
        </div>
        {detail && <p className="gauge-sub">{detail}</p>}
      </div>
    </div>
  );
}

function formatBytes(bytes) {
  if (!bytes) return "—";
  const gb = bytes / 1024 / 1024 / 1024;
  return gb >= 1024 ? `${(gb / 1024).toFixed(1)} TB` : `${gb.toFixed(1)} GB`;
}

export default function SystemPage() {
  const { loading, system, error, retry } = useDashboard();

  if (loading && !system) {
    return (
      <div className="page">
        <div className="page-head fade-up">
          <h1>System</h1>
          <p>NAS Health & Monitoring</p>
        </div>

        <div className="gauge-row" aria-busy="true">
          <div className="skeleton gauge-sk" />
          <div className="skeleton gauge-sk" />
          <div className="skeleton gauge-sk" />
        </div>

        <div className="sys-grid">
          <div className="skeleton panel-sk" />
          <div className="skeleton panel-sk" />
        </div>
      </div>
    );
  }

  if (error && !system) {
    return (
      <div className="page">
        <div className="page-head">
          <h1>System</h1>
          <p>NAS Health & Monitoring</p>
        </div>

        <div className="error-card fade-up">
          <div className="error-icon">
            <GaugeIcon size={22} />
          </div>

          <div className="error-body">
            <h3>Telemetry unavailable</h3>
            <p>
              REX OS could not read system information from the backend. Make
              sure the Express API is running, then retry.
            </p>
          </div>

          <button type="button" className="retry-btn" onClick={retry}>
            <RefreshCw size={16} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  const memUsed = system?.memory?.used ?? 0;
  const memTotal = system?.memory?.total ?? 0;
  const storageDetail = system?.storageDetail || null;

  return (
    <div className="page">
      <div className="page-head fade-up">
        <h1>System</h1>
        <p>NAS Health & Monitoring</p>
      </div>

      <div className="gauge-row">
        <Gauge
          label="CPU"
          value={system?.cpu}
          icon={Cpu}
          detail={system ? `${system.loadAvg?.[0] ?? "—"} · 1 min load` : undefined}
        />
        <Gauge
          label="Memory"
          value={system?.ram}
          icon={MemoryStick}
          detail={
            system ? `${formatBytes(memUsed)} of ${formatBytes(memTotal)}` : undefined
          }
        />
        <Gauge
          label="Storage"
          value={system?.storage}
          icon={HardDrive}
          detail={
            storageDetail
              ? `${formatBytes(storageDetail.used)} of ${formatBytes(storageDetail.total)}`
              : undefined
          }
        />
      </div>

      <div className="sys-grid">
        <section className="sys-panel fade-up">
          <h2>Host Information</h2>

          <div className="info-rows">
            <div className="info-row">
              <span>Hostname</span>
              <strong>{system?.hostname || "—"}</strong>
            </div>
            <div className="info-row">
              <span>Operating System</span>
              <strong>{system?.os || "—"}</strong>
            </div>
            <div className="info-row">
              <span>Platform</span>
              <strong>{system?.platform || "—"}</strong>
            </div>
            <div className="info-row">
              <span>Architecture</span>
              <strong>{system?.arch || "—"}</strong>
            </div>
            <div className="info-row">
              <span>CPU Cores</span>
              <strong>{system?.cores ?? "—"}</strong>
            </div>
            <div className="info-row">
              <span>Uptime</span>
              <strong>{system?.uptime || "—"}</strong>
            </div>
            <div className="info-row">
              <span>Load Average</span>
              <strong>
                {system?.loadAvg?.join(" · ") || "—"}
              </strong>
            </div>
            <div className="info-row">
              <span>Temperature</span>
              <strong>
                {system?.temperature != null ? `${system.temperature}°C` : "n/a"}
              </strong>
            </div>
          </div>
        </section>

        <div className="sys-stack" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <section className="sys-panel fade-up">
            <h2>
              <MemoryStick size={18} /> Memory
            </h2>

            <div className="detail-bar">
              <div className="detail-bar-head">
                <strong>Used</strong>
                <span>
                  {formatBytes(memUsed)} / {formatBytes(memTotal)}
                </span>
              </div>
              <div className="detail-track">
                <div
                  className="detail-fill"
                  style={{
                    width: `${system?.ram ?? 0}%`,
                    background: levelColor(system?.ram),
                  }}
                />
              </div>
            </div>
          </section>

          <section className="sys-panel fade-up">
            <h2>
              <Database size={18} /> Storage
            </h2>

            <div className="detail-bar">
              <div className="detail-bar-head">
                <strong>Used</strong>
                <span>
                  {storageDetail
                    ? `${formatBytes(storageDetail.used)} / ${formatBytes(storageDetail.total)}`
                    : `${system?.storage ?? 0}%`}
                </span>
              </div>
              <div className="detail-track">
                <div
                  className="detail-fill"
                  style={{
                    width: `${system?.storage ?? 0}%`,
                    background: levelColor(system?.storage),
                  }}
                />
              </div>
            </div>

            <div className="info-rows">
              <div className="info-row">
                <span>
                  <Activity size={14} /> Load average
                </span>
                <strong>{system?.loadAvg?.join(" · ") || "—"}</strong>
              </div>
              <div className="info-row">
                <span>
                  <Server size={14} /> Uptime
                </span>
                <strong>{system?.uptime || "—"}</strong>
              </div>
              <div className="info-row">
                <span>
                  <Thermometer size={14} /> Temperature
                </span>
                <strong>
                  {system?.temperature != null
                    ? `${system.temperature}°C`
                    : "n/a"}
                </strong>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
