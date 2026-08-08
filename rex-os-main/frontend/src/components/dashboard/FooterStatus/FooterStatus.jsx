import "./FooterStatus.css";
import {
  Server,
  Database,
  ShieldCheck,
  Cpu,
} from "lucide-react";

export default function FooterStatus() {
  const items = [
    {
      icon: Server,
      title: "Docker",
      value: "Connected",
    },
    {
      icon: Database,
      title: "Portainer",
      value: "Online",
    },
    {
      icon: ShieldCheck,
      title: "API",
      value: "Healthy",
    },
    {
      icon: Cpu,
      title: "REX OS",
      value: "v0.5 Alpha",
    },
  ];

  return (
    <section className="footer-status fade-up">
      {items.map((item) => {
        const Icon = item.icon;

        return (
          <div
            key={item.title}
            className="footer-item"
          >
            <div className="footer-icon">
              <Icon size={20} />
            </div>

            <div>
              <h4>{item.title}</h4>
              <span>{item.value}</span>
            </div>
          </div>
        );
      })}
    </section>
  );
}