import "./System.css";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  Cpu,
  HardDrive,
  MemoryStick,
  Network,
  RefreshCw,
  Server,
  Thermometer,
} from "lucide-react";

import { getSystemMetrics } from "../api/system";

const POLL_MS = 5000;

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

function formatRate(value) {
  if (value == null || !Number.isFinite(value) || value <= 0) return "—";
  const mb = value / 1024 / 1024;
  return `${mb.toFixed(2)} MB/s`;
}

function relativeTime(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 5000) return "just now";
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.max(1, Math.floor(diff / 60000))}m ago`;
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function Gauge({ label, value, icon: Icon, detail, unit = "%" }) {
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
          <strong>{value == null ? "—" : `${value}${unit}`}</strong>
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

function Section({ title, icon: Icon, children, className = "" }) {
  return (
    <section className={`sys-panel fade-up ${className}`}>
      <h2 className="sys-panel-title">
        <Icon size={17} />
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function SystemPage() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [polling, setPolling] = useState(false);
  const pollTimer = useRef(null);

  const load = useCallback(async (background = false) => {
    if (background) setPolling(true);
    try {
      const data = await getSystemMetrics();
      setMetrics(data);
      setError(null);
    } catch (err) {
      console.error("[REX OS] metrics load failed:", err);
      if (!metrics) setError(err);
    } finally {
      setLoading(false);
      setPolling(false);
    }
  }, [metrics]);

  useEffect(() => {
    load();
    pollTimer.current = setInterval(() => {
      if (!document.hidden) load(true);
    }, POLL_MS);
    function onVisible() {
      if (!document.hidden) load(true);
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(pollTimer.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  if (loading && !metrics) {
    return (
      <div className="page">
        <div className="page-head fade-up">
          <h1>System</h1>
          <p>NAS Health & Real-time Monitoring</p>
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
        <div className="sys-grid" aria-busy="true">
          <div className="skeleton panel-sk" />
          <div className="skeleton panel-sk" />
        </div>
      </div>
    );
  }

  const memory = metrics?.memory || {};
  const swap = metrics?.swap || null;
  const network = metrics?.network || {};
  const diskIo = metrics?.diskIo || null;
  const processes = metrics?.processes || [];
  const docker = metrics?.docker || null;
  const host = metrics?.host || {};
  const temperatures = metrics?.temperature || [];
  const mainTemp = temperatures?.[0]?.celsius ?? null;
  const netDown = network?.download;
  const netUp = network?.upload;
  const netLabel =
    netDown == null && netUp == null
      ? "Not reporting"
      : `↓ ${formatRate(netDown)} · ↑ ${formatRate(netUp)}`;

  return (
    <div className="page">
      <div className="page-head fade-up">
        <h1>System</h1>
        <p>NAS Health & Real-time Monitoring</p>

        <div className="sys-head-actions">
          <span className={`sys-live ${polling ? "polling" : ""}`}>
            <i /> {polling ? "Updating…" : `Live · ${relativeTime(metrics?.generatedAt)}`}
          </span>
          <button type="button" className="refresh-btn" onClick={() => load()} disabled={loading || polling}>
            <RefreshCw size={15} className={polling ? "spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="offline-strip fade-up">
          <span>Telemetry unavailable — showing the last known snapshot</span>
          <button type="button" onClick={() => load()}>
            <RefreshCw size={13} />
            Retry
          </button>
        </div>
      )}

      <div className="gauge-row">
        <Gauge label="CPU" value={metrics?.cpu} icon={Cpu} detail={host?.loadAvg?.[0] != null ? `${host.loadAvg[0]} · 1 min load` : undefined} />
        <Gauge label="Memory" value={metrics?.ram} icon={MemoryStick} detail={memory.total ? `${formatBytes(memory.used)} of ${formatBytes(memory.total)}` : undefined} />
        <Gauge label="Swap" value={swap?.percent} icon={Activity} detail={swap ? `${formatBytes(swap.used)} of ${formatBytes(swap.total)}` : "Not available"} />
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

      {mainTemp != null && (
        <div className="sys-temps fade-up">
          {temperatures.map((zone) => (
            <span className="sys-temp-chip" key={zone.zone}>
              <Thermometer size={14} />
              {zone.type || zone.zone}: <strong>{zone.celsius}°C</strong>
            </span>
          ))}
        </div>
      )}

      <div className="sys-strip">
        <Section title="Runtime" icon={Server}>
          <div className="info-rows">
            <div className="info-row">
              <span>Uptime</span>
              <strong>{host?.uptime || "—"}</strong>
            </div>
            <div className="info-row">
              <span>Load Average</span>
              <strong>{host?.loadAvg?.join(" · ") || "—"}</strong>
            </div>
            <div className="info-row">
              <span>CPU Cores</span>
              <strong>{host?.cores ?? "—"}</strong>
            </div>
            <div className="info-row">
              <span>Processes</span>
              <strong>{processes.length ? `${processes.length} tracked` : "Unavailable"}</strong>
            </div>
          </div>
        </Section>

        <Section title="Docker" icon={Boxes}>
          {docker ? (
            <div className="docker-mini">
              <div className="info-rows">
                <div className="info-row">
                  <span>Containers</span>
                  <strong>{docker.total}</strong>
                </div>
                <div className="info-row">
                  <span>Running</span>
                  <strong style={{ color: "#22c55e" }}>{docker.running}</strong>
                </div>
                <div className="info-row">
                  <span>Stopped</span>
                  <strong>{docker.stopped}</strong>
                </div>
                <div className="info-row">
                  <span>Restarting</span>
                  <strong style={{ color: docker.restarting ? "#ef4444" : undefined }}>{docker.restarting}</strong>
                </div>
                <div className="info-row">
                  <span>Unhealthy</span>
                  <strong style={{ color: docker.unhealthy ? "#f59e0b" : undefined }}>{docker.unhealthy}</strong>
                </div>
              </div>
            </div>
          ) : (
            <p className="sys-na">Docker overview unavailable (Portainer unreachable or unconfigured).</p>
          )}
        </Section>

        <Section title="Network Interfaces" icon={Network}>
          {network?.interfaces?.length ? (
            <div className="net-iface-list">
              {network.interfaces.map((iface) => (
                <div className="net-iface" key={iface.name}>
                  <div className="net-iface-name">
                    <strong>{iface.name}</strong>
                    <span>
                      ↓ {formatRate(iface.down)} · ↑ {formatRate(iface.up)}
                    </span>
                  </div>
                  <div className="net-iface-bytes">
                    <span title="Total received">{formatBytes(iface.rxBytes)} rx</span>
                    <span title="Total sent">{formatBytes(iface.txBytes)} tx</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="sys-na">Interface data not available on this host.</p>
          )}
        </Section>
      </div>

      <div className="sys-grid">
        <Section title="Host Information" icon={Server}>
          <div className="info-rows">
            <div className="info-row">
              <span>Hostname</span>
              <strong>{host?.hostname || "—"}</strong>
            </div>
            <div className="info-row">
              <span>Operating System</span>
              <strong>{host?.os || "—"}</strong>
            </div>
            <div className="info-row">
              <span>Platform</span>
              <strong>{host?.platform || "—"}</strong>
            </div>
            <div className="info-row">
              <span>Architecture</span>
              <strong>{host?.arch || "—"}</strong>
            </div>
            {host?.model && (
              <div className="info-row">
                <span>CPU Model</span>
                <strong>{host.model}</strong>
              </div>
            )}
          </div>
        </Section>

        <div className="sys-stack">
          <Section title="Memory" icon={MemoryStick}>
            <div className="detail-bar">
              <div className="detail-bar-head">
                <strong>Used</strong>
                <span>{formatBytes(memory.used)} / {formatBytes(memory.total)}</span>
              </div>
              <div className="detail-track">
                <div className="detail-fill" style={{ width: `${metrics?.ram ?? 0}%`, background: levelColor(metrics?.ram) }} />
              </div>
            </div>
            {swap && (
              <div className="detail-bar">
                <div className="detail-bar-head">
                  <strong>Swap</strong>
                  <span>{formatBytes(swap.used)} / {formatBytes(swap.total)}</span>
                </div>
                <div className="detail-track">
                  <div className="detail-fill" style={{ width: `${swap.percent ?? 0}%`, background: levelColor(swap.percent) }} />
                </div>
              </div>
            )}
          </Section>

          <Section title="Disk I/O" icon={HardDrive}>
            {diskIo ? (
              <div className="io-row">
                <div>
                  <strong className="io-read">↓ {formatRate(diskIo.readBps)}</strong>
                  <span>read</span>
                </div>
                <div>
                  <strong className="io-write">↑ {formatRate(diskIo.writeBps)}</strong>
                  <span>write</span>
                </div>
                <div>
                  <strong>{diskIo.readOps ?? "—"} / {diskIo.writeOps ?? "—"}</strong>
                  <span>read / write ops</span>
                </div>
              </div>
            ) : (
              <p className="sys-na">Disk I/O not available on this host.</p>
            )}
          </Section>
        </div>
      </div>

      {/* Top processes */}
      <Section title={`Top Processes ${processes.length ? `(${processes.length})` : ""}`} icon={Activity} className="sys-procs-card">
        {processes.length ? (
          <div className="proc-table">
            <div className="proc-colhead" aria-hidden="true">
              <span>PID</span>
              <span>Process</span>
              <span>CPU</span>
              <span>Memory</span>
              <span>RSS</span>
            </div>
            {processes.map((proc) => (
              <div className="proc-row" key={`${proc.pid}-${proc.command}`}>
                <span className="proc-pid">{proc.pid}</span>
                <span className="proc-cmd" title={proc.args}>{proc.args || proc.command}</span>
                <span className="proc-cpu">{proc.cpu != null ? `${proc.cpu}%` : "—"}</span>
                <span className="proc-mem">{proc.mem != null ? `${proc.mem}%` : "—"}</span>
                <span className="proc-rss">{formatBytes((proc.rss || 0) * 1024)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="sys-na">Process list not available on this host.</p>
        )}
      </Section>
    </div>
  );
}
