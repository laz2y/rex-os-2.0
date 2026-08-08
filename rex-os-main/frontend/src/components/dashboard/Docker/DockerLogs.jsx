import "./DockerLogs.css";

import {
  X,
  Copy,
  Download,
  RotateCw,
} from "lucide-react";

import {
  success,
} from "../../../services/toastService";

export default function DockerLogs({
  logs,
  container,
  onClose,
}) {
  if (!logs) return null;

  function copyLogs() {
    navigator.clipboard.writeText(logs);

    success("Logs copied");
  }

  function downloadLogs() {
    const blob = new Blob([logs], {
      type: "text/plain",
    });

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");

    a.href = url;

    a.download = `${container.name}-logs.txt`;

    a.click();

    URL.revokeObjectURL(url);

    success("Logs downloaded");
  }

  return (
    <div
      className="logs-overlay"
      onClick={onClose}
    >
      <div
        className="logs-window"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="logs-header">

          <h2>
            📜 {container.name} Logs
          </h2>

          <div className="logs-actions">

            <button onClick={copyLogs}>
              <Copy size={18}/>
            </button>

            <button onClick={downloadLogs}>
              <Download size={18}/>
            </button>

            <button disabled>
              <RotateCw size={18}/>
            </button>

            <button onClick={onClose}>
              <X size={20}/>
            </button>

          </div>

        </div>

        <pre className="logs-body">
          {logs}
        </pre>

      </div>
    </div>
  );
}