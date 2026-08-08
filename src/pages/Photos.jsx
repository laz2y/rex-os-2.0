import "./Cloud.css";

import { Camera, ExternalLink } from "lucide-react";

import { services } from "../data/services";

export default function Photos() {
  const immich = services.find((service) => service.id === "immich");

  return (
    <div className="page">
      <div className="page-head fade-up">
        <h1>Photos</h1>
        <p>Your Immich library</p>
      </div>

      <div className="empty-state fade-up">
        <div className="empty-icon">
          <Camera size={28} />
        </div>
        <h3>Immich handles your photos</h3>
        <p>
          REX OS keeps the Immich library in its own app — open it to browse,
          search and share your photos. The thumbnail grid stays in Immich.
        </p>

        {immich && (
          <a
            className="retry-btn"
            href={immich.url}
            target="_blank"
            rel="noreferrer"
            style={{ marginTop: 8 }}
          >
            Open Immich
            <ExternalLink size={16} />
          </a>
        )}
      </div>

      <div className="cloud-grid fade-up d-2">
        {immich && (
          <a
            key={immich.id}
            href={immich.url}
            target="_blank"
            rel="noreferrer"
            className="service-tile"
          >
            <div
              className="service-tile-icon"
              style={{ background: immich.color }}
            >
              <immich.icon size={24} />
            </div>

            <div className="service-tile-info">
              <h3>{immich.name}</h3>
              <p>{immich.description}</p>
              <span className="tile-open">
                Open
                <ExternalLink size={12} />
              </span>
            </div>
          </a>
        )}
      </div>
    </div>
  );
}
