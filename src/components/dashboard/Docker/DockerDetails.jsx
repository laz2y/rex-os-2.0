import "./DockerDetails.css";

import {
  X,
  Server,
  Play,
  Square,
  RotateCw,
  FileText,
} from "lucide-react";

import { useState } from "react";

import {
  restartContainer,
  startContainer,
  stopContainer,
  getContainerLogs,
} from "../../../services/dockerService";

import DockerLogs from "./DockerLogs";

import {
  success,
  error,
} from "../../../services/toastService";

export default function DockerDetails({
  container,
  onClose,
}) {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState(null);

  if (!container) return null;

  async function handleRestart() {
    try {
      setLoading(true);

      await restartContainer(container.id);

      success(`${container.name} restarted`);

      onClose();
    } catch (err) {
      console.error(err);
      error("Restart failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleStart() {
    try {
      setLoading(true);

      await startContainer(container.id);

      success(`${container.name} started`);

      onClose();
    } catch (err) {
      console.error(err);
      error("Start failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleStop() {
    try {
      setLoading(true);

      await stopContainer(container.id);

      success(`${container.name} stopped`);

      onClose();
    } catch (err) {
      console.error(err);
      error("Stop failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogs() {
    try {
      setLoading(true);

      const data = await getContainerLogs(container.id);

      setLogs(data);
    } catch (err) {
      console.error(err);
      error("Failed to load logs");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div
        className="docker-overlay"
        onClick={onClose}
      >
        <div
          className="docker-details"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="close-btn"
            onClick={onClose}
          >
            <X size={22} />
          </button>

          {/* Scrollable body — flex: 1 + min-height: 0 keeps the action
              bar below fully visible at any viewport height. */}
          <div className="details-content">
            <div className="details-header">
              <div className="details-icon">
                <Server size={30} />
              </div>

              <div>
                <h2>{container.name}</h2>
                <p>{container.image}</p>
              </div>
            </div>

            <div className="details-grid">
              <div>
                <span>Status</span>
                <strong>{container.state}</strong>
              </div>

              <div>
                <span>Uptime</span>
                <strong>{container.status}</strong>
              </div>
            </div>
          </div>

          {/* Pinned action bar — never clipped, never pushed off-screen */}
          <div className="details-actions">

            <button
              disabled={loading}
              onClick={handleStart}
            >
              <Play size={18} />
              {loading ? "Working..." : "Start"}
            </button>

            <button
              disabled={loading}
              onClick={handleStop}
            >
              <Square size={18} />
              {loading ? "Working..." : "Stop"}
            </button>

            <button
              disabled={loading}
              onClick={handleRestart}
            >
              <RotateCw size={18} />
              {loading ? "Working..." : "Restart"}
            </button>

            <button
              disabled={loading}
              onClick={handleLogs}
            >
              <FileText size={18} />
              Logs
            </button>

          </div>
        </div>
      </div>

      <DockerLogs
        logs={logs}
        container={container}
        onClose={() => setLogs(null)}
      />
    </>
  );
}
