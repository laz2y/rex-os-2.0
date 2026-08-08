import "./DockerWidget.css";

import { Boxes, ExternalLink, RefreshCw, Server } from "lucide-react";

import DockerDetails from "./DockerDetails";
import useDocker from "../../../hooks/useDocker";
import { services } from "../../../data/services";

function RowSkeleton() {
  return (
    <div className="docker-card">
      <div className="docker-card-top">
        <div className="skeleton sk-icon" />
        <div className="docker-info">
          <div className="skeleton sk-title-sm" />
          <div className="skeleton sk-sub-sm" />
        </div>
      </div>
      <div className="skeleton sk-line" />
    </div>
  );
}

export default function DockerWidget({ docker, loading, error, onRetry }) {
  const { selectedContainer, openContainer, closeContainer } = useDocker();

  const portainer = services.find((service) => service.id === "docker");

  if (loading) {
    return (
      <section className="docker-widget fade-up" aria-busy="true">
        <div className="docker-header">
          <div className="skeleton sk-title-w" />
        </div>
        <div className="docker-grid">
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </div>
      </section>
    );
  }

  if (error && !docker) {
    return (
      <section className="docker-widget fade-up">
        <div className="error-card">
          <div className="error-icon">
            <Boxes size={22} />
          </div>

          <div className="error-body">
            <h3>Docker is unreachable</h3>
            <p>
              Could not reach Portainer. Check that Portainer is running and the
              API token is configured, then try again.
            </p>
          </div>

          <button type="button" className="retry-btn" onClick={onRetry}>
            <RefreshCw size={16} />
            Retry
          </button>
        </div>
      </section>
    );
  }

  const containers = docker?.containers || [];

  return (
    <>
      <section className="docker-widget fade-up">
        <div className="docker-header">
          <div className="docker-header-top">
            <h2>Docker Containers</h2>

            {portainer && (
              <a
                className="widget-link"
                href={portainer.url}
                target="_blank"
                rel="noreferrer"
              >
                Open Portainer
                <ExternalLink size={15} />
              </a>
            )}
          </div>

          <p>
            {docker?.running ?? 0} Running • {docker?.stopped ?? 0} Stopped
          </p>
        </div>

        {containers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <Server size={24} />
            </div>
            <h4>No containers found</h4>
            <p>Containers started on your NAS will appear here.</p>
          </div>
        ) : (
          <div className="docker-grid">
            {containers.map((container) => (
              <div
                key={container.id}
                className="docker-card"
                onClick={() => openContainer(container)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openContainer(container);
                  }
                }}
              >
                <div className="docker-card-top">
                  <div className="docker-icon">
                    <Server size={18} />
                  </div>

                  <div className="docker-info">
                    <h3>{container.name}</h3>
                    <small>{container.image}</small>
                  </div>
                </div>

                <div className="docker-status">
                  <span
                    className={`badge ${
                      container.state === "running" ? "success" : "danger"
                    }`}
                  >
                    {container.state}
                  </span>
                </div>

                <div className="docker-footer">{container.status}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <DockerDetails container={selectedContainer} onClose={closeContainer} />
    </>
  );
}
