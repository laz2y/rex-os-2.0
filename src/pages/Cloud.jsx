import "./Cloud.css";

import { Cloud as CloudIcon, ExternalLink } from "lucide-react";

import { services } from "../data/services";

export default function Cloud() {
  return (
    <div className="page">
      <div className="page-head fade-up">
        <h1>Cloud Services</h1>
        <p>Everything running on your NAS, one launch pad</p>
      </div>

      <div className="cloud-grid fade-up">
        {services.map((service) => {
          const Icon = service.icon;

          return (
            <a
              key={service.id}
              href={service.url}
              target="_blank"
              rel="noreferrer"
              className="service-tile"
            >
              <div
                className="service-tile-icon"
                style={{ background: service.color }}
              >
                <Icon size={24} />
              </div>

              <div className="service-tile-info">
                <h3>{service.name}</h3>
                <p>{service.description}</p>

                <div className="tile-meta">
                  <span className={`tile-cat ${service.category}`}>
                    {service.category}
                  </span>
                  <span className="tile-open">
                    Open
                    <ExternalLink size={12} />
                  </span>
                </div>
              </div>
            </a>
          );
        })}
      </div>

      <p
        className="fade-up"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          color: "var(--text-secondary)",
          fontSize: 13,
        }}
      >
        <CloudIcon size={14} />
        {services.length} services registered in{" "}
        <code style={{ color: "white" }}>src/data/services.js</code>
      </p>
    </div>
  );
}
