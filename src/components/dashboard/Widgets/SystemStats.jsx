import "./SystemStats.css";
import {
  Boxes,
  Cpu,
  HardDrive,
  MemoryStick,
  Network,
  RefreshCw,
  TrendingUp,
} from "lucide-react";

const COLORS = {
  cpu: "#3b82f6",
  ram: "#8b5cf6",
  storage: "#22c55e",
  network: "#06b6d4",
  docker: "#f97316",
};

function StatSkeleton() {
  return (
    <div className="stat-card">
      <div className="stat-header">
        <div className="skeleton stat-icon-sk" />
        <div className="stat-sk-text">
          <div className="skeleton sk-title" />
          <div className="skeleton sk-sub" />
        </div>
      </div>
      <div className="skeleton sk-value" />
      <div className="skeleton sk-line" />
    </div>
  );
}

export default function SystemStats({ system, docker, loading, error, onRetry }) {
  const offline = !loading && !system && !docker;

  if (loading && !system && !docker) {
    return (
      <div className="stats-grid fade-up" aria-busy="true">
        <StatSkeleton />
        <StatSkeleton />
        <StatSkeleton />
        <StatSkeleton />
        <StatSkeleton />
      </div>
    );
  }

  const network = system?.network;
  const netDown = network?.down ?? network?.rx ?? null;
  const netUp = network?.up ?? network?.tx ?? null;

  const stats = [
    {
      title: "CPU",
      subtitle: "System Load",
      value: system?.cpu ?? null,
      unit: "%",
      icon: Cpu,
      color: COLORS.cpu,
      pct: system?.cpu ?? null,
    },
    {
      title: "Memory",
      subtitle: "RAM Usage",
      value: system?.ram ?? null,
      unit: "%",
      icon: MemoryStick,
      color: COLORS.ram,
      pct: system?.ram ?? null,
    },
    {
      title: "Storage",
      subtitle: "Disk Usage",
      value: system?.storage ?? null,
      unit: "%",
      icon: HardDrive,
      color: COLORS.storage,
      pct: system?.storage ?? null,
    },
    {
      title: "Network",
      subtitle: "Throughput",
      value: netDown,
      unit: " MB/s",
      icon: Network,
      color: COLORS.network,
      pct: null,
      footer:
        netDown == null && netUp == null
          ? "Not reporting"
          : `↑ ${netUp ?? "—"} MB/s`,
    },
    {
      title: "Docker",
      subtitle: "Running Containers",
      value: docker?.running ?? null,
      unit: "",
      icon: Boxes,
      color: COLORS.docker,
      pct: null,
      docker: true,
      footer: docker
        ? docker.stopped > 0
          ? `${docker.stopped} stopped`
          : "All up"
        : "Not reporting",
    },
  ];

  return (
    <div className="stats-grid fade-up">
      {offline && (
        <div className="stats-offline">
          <span>Telemetry unavailable — showing placeholders</span>
          <button type="button" onClick={onRetry}>
            <RefreshCw size={13} />
            Retry
          </button>
        </div>
      )}

      {stats.map((stat, index) => {
        const Icon = stat.icon;
        const hasValue = typeof stat.value === "number";

        return (
          <div key={stat.title} className={`stat-card d-${index + 1}`}>
            <div className="stat-header">
              <div className="stat-icon" style={{ background: stat.color }}>
                <Icon size={20} />
              </div>

              <div>
                <h4>{stat.title}</h4>
                <p>{stat.subtitle}</p>
              </div>
            </div>

            <div className="stat-value">
              {hasValue ? stat.value : "—"}
              {hasValue && stat.unit}
            </div>

            <div className="stat-footer">
              <div
                className="stat-status"
                style={{
                  color:
                    stat.pct != null
                      ? stat.pct > 85
                        ? "#ef4444"
                        : "#22c55e"
                      : "var(--text-secondary)",
                }}
              >
                <TrendingUp size={14} />
                {stat.pct != null ? (stat.pct > 85 ? "Heavy" : "Healthy") : "—"}
              </div>

              <span>{stat.footer ?? (hasValue ? `${stat.value}${stat.unit}` : "—")}</span>
            </div>

            {stat.pct != null && (
              <div className="progress">
                <div
                  className="progress-fill"
                  style={{
                    width: `${stat.pct}%`,
                    background: stat.color,
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
