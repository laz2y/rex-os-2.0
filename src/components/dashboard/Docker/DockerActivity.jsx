import "./DockerActivity.css";

import { Boxes, ExternalLink, RefreshCw } from "lucide-react";

import { services } from "../../../data/services";

export default function DockerActivity({ docker, loading, error, onRetry }) {
  const portainer = services.find((service) => service.id === "docker");

  if (loading && !docker) {
    return (
      <section className="docker-activity fade-up" aria-busy="true">
        <div className="docker-activity-head">
          <div className="skeleton sk-title-sm" />
        </div>
        <div className="skeleton sk-line" />
        <div className="skeleton sk-line" />
      </section>
    );
  }

  const containers = docker?.containers || [];

  return (
    <section className="docker-activity fade-up">
      <div className="docker-activity-head">
        <h2>
          <Boxes size={17} />
          Docker Activity
        </h2>

        {portainer && (
          <a
            className="widget-link"
            href={portainer.url}
            target="_blank"
            rel="noreferrer"
          >
            Portainer
            <ExternalLink size={13} />
          </a>
        )}
      </div>

      {error && !docker ? (
        <div className="activity-error">
          <span>Portainer unreachable</span>
          <button type="button" onClick={onRetry}>
            <RefreshCw size={13} />
            Retry
          </button>
        </div>
      ) : containers.length === 0 ? (
        <p className="activity-empty">No containers found on this host.</p>
      ) : (
        <div className="activity-list">
          {containers.slice(0, 5).map((container) => (
            <div className="activity-row" key={container.id}>
              <span
                className={`act-dot ${
                  container.state === "running" ? "ok" : "bad"
                }`}
              />
              <span className="act-name" title={container.name}>
                {container.name}
              </span>
              <span
                className={`badge ${
                  container.state === "running" ? "success" : "danger"
                }`}
              >
                {container.state}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="docker-activity-foot">
        {docker
          ? `${docker.running} running • ${docker.stopped} stopped`
          : "Docker status pending"}
      </div>
    </section>
  );
}
