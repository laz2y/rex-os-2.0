import "./Home.css";

import { AlertTriangle, CalendarDays, RefreshCw } from "lucide-react";

import HomeHero from "../components/dashboard/Home/HomeHero";
import SystemStats from "../components/dashboard/Widgets/SystemStats";
import QuickLaunch from "../components/dashboard/QuickLaunch/QuickLaunch";
import DockerWidget from "../components/dashboard/Docker/DockerWidget";
import JellyfinWidget from "../components/dashboard/Jellyfin/JellyfinWidget";
import ContinueWatching from "../components/dashboard/Media/ContinueWatching";
import Notifications from "../components/dashboard/Notifications/Notifications";
import Activity from "../components/dashboard/Activity/Activity";
import FooterStatus from "../components/dashboard/FooterStatus/FooterStatus";

import useDashboard from "../hooks/useDashboard";
import useLiveClock from "../hooks/useLiveClock";
import { config } from "../data/config";

export default function Home() {
  const { loading, system, docker, error, retry, online } = useDashboard();
  const { date, hour } = useLiveClock();

  const apiDown = error && !system && !docker;

  const greeting =
    hour < 12
      ? "Good Morning"
      : hour < 18
      ? "Good Afternoon"
      : "Good Evening";

  return (
    <div className="home">
      {/* 1. Hero banner — the very first visual element */}
      <HomeHero />

      {/* 2. Greeting underneath the banner */}
      <div className="home-greeting fade-up">
        <div>
          <h2>
            {greeting}, {config.userName} 👋
          </h2>
          <p>One Dream. One Will. One Power.</p>
        </div>

        <div className="home-greeting-date">
          <CalendarDays size={16} />
          <span>{date}</span>
        </div>
      </div>

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

      {/* 3. System statistics across the top */}
      <SystemStats
        system={system}
        docker={docker}
        loading={loading}
        error={error}
        onRetry={retry}
      />

      {/* 4. Services / Quick Launch strip */}
      <QuickLaunch />

      {/* 5. Main control-center split: Jellyfin column + Docker column */}
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

      {/* 6. Remaining status sections */}
      <div className="home-lower">
        <Notifications />
        <Activity />
      </div>

      <FooterStatus system={system} docker={docker} online={online} />
    </div>
  );
}
