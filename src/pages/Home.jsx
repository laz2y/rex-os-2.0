import "./Home.css";

import { AlertTriangle, RefreshCw } from "lucide-react";

import SystemStats from "../components/dashboard/Widgets/SystemStats";
import QuickLaunch from "../components/dashboard/QuickLaunch/QuickLaunch";
import DockerWidget from "../components/dashboard/Docker/DockerWidget";
import JellyfinWidget from "../components/dashboard/Jellyfin/JellyfinWidget";
import ContinueWatching from "../components/dashboard/Media/ContinueWatching";
import Notifications from "../components/dashboard/Notifications/Notifications";
import Activity from "../components/dashboard/Activity/Activity";
import FooterStatus from "../components/dashboard/FooterStatus/FooterStatus";

import useDashboard from "../hooks/useDashboard";

export default function Home() {
  const { loading, system, docker, error, retry, online } = useDashboard();

  // First load failed and we have no data at all — full-screen offline card.
  if (error && !system && !docker && !loading) {
    return (
      <div className="page">
        <div className="api-offline fade-up">
          <h3>
            <AlertTriangle size={20} />
            Backend is unreachable
          </h3>

          <p>
            REX OS could not reach the REX API at{" "}
            <code>{import.meta.env.VITE_API_URL || "http://localhost:4000/api"}</code>.
            Make sure the Express backend is running, then retry.
          </p>

          <button type="button" className="retry-btn" onClick={retry}>
            <RefreshCw size={16} />
            Retry connection
          </button>
        </div>

        <QuickLaunch />
        <FooterStatus system={null} docker={null} online={false} />
      </div>
    );
  }

  return (
    <div className="home">
      {error && (system || docker) && (
        <div className="stale-banner fade-up">
          <span>
            Live data may be stale — the last successful sync was a moment ago.
          </span>
          <button type="button" onClick={retry}>
            Retry now
          </button>
        </div>
      )}

      <SystemStats system={system} docker={docker} loading={loading} />

      <JellyfinWidget />

      <div className="home-grid">
        <DockerWidget
          docker={docker}
          loading={loading}
          error={error}
          onRetry={retry}
        />

        <div className="home-stack">
          <ContinueWatching />
          <Notifications />
          <Activity />
        </div>
      </div>

      <QuickLaunch />

      <FooterStatus system={system} docker={docker} online={online} />
    </div>
  );
}
