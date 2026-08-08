import "./Activity.css";
import {
  CheckCircle2,
  Download,
  RefreshCw,
  Camera,
} from "lucide-react";

const activities = [
  {
    icon: CheckCircle2,
    title: "Jellyfin library scanned",
    time: "2 min ago",
  },
  {
    icon: Download,
    title: "qBittorrent completed Ubuntu ISO",
    time: "14 min ago",
  },
  {
    icon: Camera,
    title: "Immich indexed 53 photos",
    time: "1 hour ago",
  },
  {
    icon: RefreshCw,
    title: "Watchtower updated Homepage",
    time: "3 hours ago",
  },
];

export default function Activity() {
  return (
    <section className="activity fade-up">
      <div className="activity-header">
        <h2>Recent Activity</h2>
      </div>

      <div className="activity-list">
        {activities.map((item, index) => {
          const Icon = item.icon;

          return (
            <div className="activity-item" key={index}>
              <div className="activity-icon">
                <Icon size={18} />
              </div>

              <div className="activity-info">
                <h4>{item.title}</h4>
                <span>{item.time}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}