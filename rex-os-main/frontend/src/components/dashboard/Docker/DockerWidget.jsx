import "./DockerWidget.css";

import { Server } from "lucide-react";

import DockerDetails from "./DockerDetails";
import useDocker from "../../../hooks/useDocker";

export default function DockerWidget({ docker }) {
  const {
    selectedContainer,
    openContainer,
    closeContainer,
  } = useDocker();

  if (!docker) return null;

  return (
    <>
      <section className="docker-widget fade-up">
        <div className="docker-header">
          <h2>Docker Containers</h2>

          <p>
            {docker.running} Running • {docker.stopped} Stopped
          </p>
        </div>

        <div className="docker-grid">
          {docker.containers.map((container) => (
            <div
              key={container.id}
              className="docker-card"
              onClick={() => openContainer(container)}
              style={{ cursor: "pointer" }}
            >
              <div className="docker-card-top">
                <div className="docker-icon">
                  <Server size={18} />
                </div>

                <div className="docker-info">
                  <h3>{container.name}</h3>

                  <small>{container.state}</small>
                </div>
              </div>

              <div className="docker-footer">
                {container.status}
              </div>
            </div>
          ))}
        </div>
      </section>

      <DockerDetails
        container={selectedContainer}
        onClose={closeContainer}
      />
    </>
  );
}