import "./Home.css";

import Header from "../components/dashboard/Header/Header";
import SystemStats from "../components/dashboard/Widgets/SystemStats";
import QuickLaunch from "../components/dashboard/QuickLaunch/QuickLaunch";
import DockerWidget from "../components/dashboard/Docker/DockerWidget";
import JellyfinWidget from "../components/dashboard/Jellyfin/JellyfinWidget";
import Activity from "../components/dashboard/Activity/Activity";
import FooterStatus from "../components/dashboard/FooterStatus/FooterStatus";

import useDashboard from "../hooks/useDashboard";

export default function Home() {
  const { system, docker } = useDashboard();

  if (!system || !docker) {
    return (
      <div
        style={{
          color: "white",
          padding: "40px",
          fontSize: "20px",
        }}
      >
        Loading REX OS...
      </div>
    );
  }

  return (
    <div className="home">

      <Header />

      <SystemStats
        system={system}
        docker={docker}
      />

      <QuickLaunch />

      <JellyfinWidget />

      <DockerWidget
        docker={docker}
      />

      <Activity />

      <FooterStatus />

    </div>
  );
}