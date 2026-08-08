import "./SystemStats.css";
import {
  Cpu,
  MemoryStick,
  HardDrive,
  Boxes,
  TrendingUp,
} from "lucide-react";

const COLORS = {
  cpu: "#3b82f6",
  ram: "#8b5cf6",
  storage: "#22c55e",
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

export default function SystemStats({ system, docker, loading }) {
  if (loading || !system || !docker) {
    return (
      <div className="stats-grid fade-up" aria-busy="true">
        <StatSkeleton />
        <StatSkeleton />
        <StatSkeleton />
        <StatSkeleton />
      </div>
    );
  }

  const stats = [
    {
      title: "CPU",
      subtitle: "System Load",
      value: system.cpu,
      icon: Cpu,
      color: COLORS.cpu,
    },
    {
      title: "Memory",
      subtitle: "RAM Usage",
      value: system.ram,
      icon: MemoryStick,
      color: COLORS.ram,
    },
    {
      title: "Storage",
      subtitle: "Disk Usage",
      value: system.storage,
      icon: HardDrive,
      color: COLORS.storage,
    },
    {
      title: "Docker",
      subtitle: "Running Containers",
      value: docker.running,
      icon: Boxes,
      color: COLORS.docker,
      docker: true,
    },
  ];

  return (
    <div className="stats-grid fade-up">
      {stats.map((stat, index) => {
        const Icon = stat.icon;

        return (
          <div
            key={stat.title}
            className={`stat-card d-${index + 1}`}
          >
            <div className="stat-header">
              <div
                className="stat-icon"
                style={{ background: stat.color }}
              >
                <Icon size={22} />
              </div>

              <div>
                <h4>{stat.title}</h4>
                <p>{stat.subtitle}</p>
              </div>
            </div>

            <div className="stat-value">
              {stat.value}
              {!stat.docker && "%"}
            </div>

            <div className="stat-footer">
              <div
                className="stat-status"
                style={{
                  color: stat.value > 85 ? "#ef4444" : "#22c55e",
                }}
              >
                <TrendingUp size={15} />
                {stat.value > 85 ? "Heavy" : "Healthy"}
              </div>

              <span>
                {stat.docker
                  ? docker.stopped > 0
                    ? `${docker.stopped} stopped`
                    : "All up"
                  : `${stat.value}%`}
              </span>
            </div>

            <div className="progress">
              <div
                className="progress-fill"
                style={{
                  width: stat.docker
                    ? "100%"
                    : `${stat.value}%`,
                  background: stat.color,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
