import "./Photos.css";

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

      {immich ? (
        <>
          <section className="immich-card fade-up">
            <div className="immich-banner">
              <div
                className="immich-icon"
                style={{
                  background: immich.color,
                  boxShadow: `0 12px 28px ${immich.color}55`,
                }}
              >
                <immich.icon size={30} />
              </div>

              <div className="immich-title">
                <h2>{immich.name}</h2>
                <span>Photos & Videos • {immich.description}</span>
              </div>

              <a
                className="retry-btn"
                href={immich.url}
                target="_blank"
                rel="noreferrer"
              >
                Open Immich
                <ExternalLink size={16} />
              </a>
            </div>

            <div className="immich-body">
              <div className="immich-row">
                <span>Service</span>
                <strong>Photo library & timeline</strong>
              </div>
              <div className="immich-row">
                <span>Address</span>
                <strong>{immich.url}</strong>
              </div>
              <div className="immich-row">
                <span>Library</span>
                <strong>Browsing stays in Immich</strong>
              </div>
            </div>
          </section>

          <a
            className="service-tile fade-up d-2"
            href={immich.url}
            target="_blank"
            rel="noreferrer"
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
        </>
      ) : (
        <div className="empty-state fade-up">
          <div className="empty-icon">
            <Camera size={26} />
          </div>
          <h3>Immich is not configured</h3>
          <p>Add Immich to src/data/services.js to launch it from REX OS.</p>
        </div>
      )}
    </div>
  );
}
