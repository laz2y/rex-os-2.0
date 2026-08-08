import "./SystemStats.css";
import {
  Cpu,
  MemoryStick,
  HardDrive,
  Boxes,
  TrendingUp,
} from "lucide-react";

export default function SystemStats({ system, docker }) {
  if (!system || !docker) return null;

  const stats = [
    {
      title: "CPU",
      subtitle: "System Load",
      value: system.cpu,
      icon: Cpu,
      color: "#3b82f6",
    },
    {
      title: "Memory",
      subtitle: "RAM Usage",
      value: system.ram,
      icon: MemoryStick,
      color: "#8b5cf6",
    },
    {
      title: "Storage",
      subtitle: "Disk Usage",
      value: system.storage,
      icon: HardDrive,
      color: "#22c55e",
    },
    {
      title: "Docker",
      subtitle: "Running Containers",
      value: docker.running,
      icon: Boxes,
      color: "#f97316",
      docker: true,
    },
  ];

  return (
    <div className="stats-grid fade-up">
      {stats.map((stat) => {
        const Icon = stat.icon;

        return (
          <div
            key={stat.title}
            className="stat-card"
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

              <div className="stat-status">

                <TrendingUp size={15} />

                Healthy

              </div>

              <span>
                {stat.docker
                  ? "Online"
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