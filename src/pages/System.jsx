import "./System.css";

import {
  Activity,
  Cpu,
  Database,
  HardDrive,
  MemoryStick,
  Network,
  RefreshCw,
  Server,
  ShieldCheck,
  Thermometer,
} from "lucide-react";

import useDashboard from "../hooks/useDashboard";

function levelColor(value) {
  if (value == null) return "var(--primary)";
  if (value > 85) return "#ef4444";
  if (value > 70) return "#f59e0b";
  return "var(--primary)";
}

function formatBytes(bytes) {
  if (!bytes) return "—";
  const gb = bytes / 1024 / 1024 / 1024;
  return gb >= 1024 ? `${(gb / 1024).toFixed(1)} TB` : `${gb.toFixed(1)} GB`;
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

export default function SystemPage() {
  const { loading, system, error, retry, online } = useDashboard();

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
          <div className="skeleton gauge-sk" />
        </div>

        <div className="sys-strip" aria-busy="true">
          <div className="skeleton panel-sk-sm" />
          <div className="skeleton panel-sk-sm" />
          <div className="skeleton panel-sk-sm" />
        </div>

        <div className="sys-grid">
          <div className="skeleton panel-sk" />
          <div className="skeleton panel-sk" />
        </div>
      </div>
    );
  }

  const memUsed = system?.memory?.used ?? 0;
  const memTotal = system?.memory?.total ?? 0;
  const storageDetail = system?.storageDetail || null;
  const network = system?.network || null;
  const netDown = network?.down ?? network?.rx ?? null;
  const netUp = network?.up ?? network?.tx ?? null;
  const netLabel =
    netDown == null && netUp == null
      ? "Not reporting"
      : `↓ ${netDown ?? "—"} MB/s · ↑ ${netUp ?? "—"} MB/s`;
  const unavailable = !system;

  return (
    <div className="page">
      <div className="page-head fade-up">
        <h1>System</h1>
        <p>NAS Health & Monitoring</p>
      </div>

      {error && unavailable && (
        <div className="offline-strip fade-up">
          <span>
            <ShieldCheck size={15} />
            Telemetry unavailable — showing placeholders
          </span>
          <button type="button" onClick={retry}>
            <RefreshCw size={13} />
            Retry
          </button>
        </div>
      )}

      <div className="gauge-row">
        <Gauge
          label="CPU"
          value={system?.cpu}
          icon={Cpu}
          detail={
            system ? `${system.loadAvg?.[0] ?? "—"} · 1 min load` : undefined
          }
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

        <div className="gauge-card fade-up net-card">
          <div className="gauge-ring static">
            <div className="gauge-inner">
              <Network size={28} style={{ color: "#06b6d4" }} />
              <span>Network</span>
            </div>
          </div>

          <div>
            <div className="gauge-title">
              <Network size={16} style={{ color: "#06b6d4" }} />
              Network
            </div>
            <p className="gauge-sub">{netLabel}</p>
          </div>
        </div>
      </div>

      <div className="sys-strip">
        <section className="sys-panel info-card fade-up">
          <h2>
            <Server size={17} /> Runtime
          </h2>

          <div className="info-rows">
            <div className="info-row">
              <span>Uptime</span>
              <strong>{system?.uptime || "—"}</strong>
            </div>
            <div className="info-row">
              <span>Load Average</span>
              <strong>{system?.loadAvg?.join(" · ") || "—"}</strong>
            </div>
            <div className="info-row">
              <span>Temperature</span>
              <strong>
                {system?.temperature != null ? `${system.temperature}°C` : "n/a"}
              </strong>
            </div>
          </div>
        </section>

        <section className="sys-panel info-card fade-up">
          <h2>
            <Database size={17} /> Disk
          </h2>

          <div className="info-rows">
            <div className="info-row">
              <span>Used</span>
              <strong>{storageDetail ? formatBytes(storageDetail.used) : "—"}</strong>
            </div>
            <div className="info-row">
              <span>Total</span>
              <strong>{storageDetail ? formatBytes(storageDetail.total) : "—"}</strong>
            </div>
            <div className="info-row">
              <span>Free</span>
              <strong>
                {storageDetail
                  ? formatBytes(Math.max(0, storageDetail.total - storageDetail.used))
                  : "—"}
              </strong>
            </div>
            <div className="info-row">
              <span>Usage</span>
              <strong>{system?.storage != null ? `${system.storage}%` : "—"}</strong>
            </div>
          </div>
        </section>

        <section className="sys-panel info-card fade-up">
          <h2>
            <ShieldCheck size={17} /> Backend
          </h2>

          <div className="info-rows">
            <div className="info-row">
              <span>Status</span>
              <strong style={{ color: online ? "#22c55e" : "#ef4444" }}>
                {online ? "Connected" : "Unreachable"}
              </strong>
            </div>
            <div className="info-row">
              <span>Endpoint</span>
              <strong>{import.meta.env.VITE_API_URL || "/api"}</strong>
            </div>
            <div className="info-row">
              <span>Telemetry</span>
              <strong>{unavailable ? "—" : "Live"}</strong>
            </div>
          </div>
        </section>
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
          </div>
        </section>

        <div className="sys-stack">
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
              <Activity size={18} /> Storage
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
                  <Thermometer size={14} /> Temperature
                </span>
                <strong>
                  {system?.temperature != null ? `${system.temperature}°C` : "n/a"}
                </strong>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
