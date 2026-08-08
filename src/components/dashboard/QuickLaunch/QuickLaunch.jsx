import "./QuickLaunch.css";
import { services } from "../../../data/services";

export default function QuickLaunch() {
  return (
    <section className="quick-launch fade-up">
      <div className="section-header">
        <h2>Quick Launch</h2>
        <span>{services.length} Services</span>
      </div>

      <div className="launch-grid">
        {services.map((service) => {
          const Icon = service.icon;

          return (
            <a
              key={service.id}
              href={service.url}
              target="_blank"
              rel="noreferrer"
              className="launch-card"
            >
              <div
                className="launch-icon"
                style={{ background: service.color }}
              >
                <Icon size={26} color="white" />
              </div>

              <span className="launch-title">
                {service.name}
              </span>
            </a>
          );
        })}
      </div>
    </section>
  );
}