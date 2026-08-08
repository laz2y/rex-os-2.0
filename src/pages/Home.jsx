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

  const apiDown = error && !system && !docker;

  return (
    <div className="home">
      {apiDown && (
        <div className="offline-strip fade-up">
          <span>
            <AlertTriangle size={15} />
            Backend unreachable — widgets show their last known state
          </span>
          <button type="button" onClick={retry}>
            <RefreshCw size={13} />
            Retry
          </button>
        </div>
      )}

      {error && !apiDown && (
        <div className="stale-banner fade-up">
          <span>Live data may be stale — the last successful sync was a moment ago.</span>
          <button type="button" onClick={retry}>
            Retry now
          </button>
        </div>
      )}

      {/* System cards across the top */}
      <SystemStats
        system={system}
        docker={docker}
        loading={loading}
        error={error}
        onRetry={retry}
      />

      {/* Main control-center split: Jellyfin column + Docker column */}
      <div className="home-main">
        <div className="home-side">
          <JellyfinWidget />
          <ContinueWatching />
        </div>

        <div className="home-side">
          <DockerWidget
            docker={docker}
            loading={loading}
            error={error}
            onRetry={retry}
          />
        </div>
      </div>

      {/* Services / Quick Launch strip */}
      <QuickLaunch />

      <div className="home-lower">
        <Notifications />
        <Activity />
      </div>

      <FooterStatus system={system} docker={docker} online={online} />
    </div>
  );
}
