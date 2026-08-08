import "./JellyfinWidget.css";

import { useEffect, useState } from "react";
import { Clapperboard, Play } from "lucide-react";

import HeroBanner from "./HeroBanner";
import useHeroBanner from "../../../hooks/useHeroBanner";

import {
  getJellyfinServer,
  getLatestMedia,
} from "../../../services/jellyfinService";

const API_URL = import.meta.env.VITE_API_URL.replace("/api", "");

export default function JellyfinWidget() {
  const [server, setServer] = useState(null);
  const [latest, setLatest] = useState([]);

  useEffect(() => {
    async function load() {
      try {
        const info = await getJellyfinServer();
        const media = await getLatestMedia();

        setServer(info);
        setLatest(media);
      } catch (err) {
        console.error(err);
      }
    }

    load();
  }, []);

  const featured = useHeroBanner(latest);

  if (!server) {
    return (
      <section className="jellyfin-widget">
        Loading Jellyfin...
      </section>
    );
  }

  return (
    <section className="jellyfin-widget">

      <HeroBanner
        item={
          featured && {
            ...featured,
            backdrop: `${API_URL}${featured.backdrop}`,
          }
        }
      />

      <div className="jellyfin-header">
        <div>
          <h2>
            <Clapperboard size={24}/>
            Jellyfin
          </h2>

          <p>
            {server.serverName} • {server.version}
          </p>
        </div>
      </div>

      <h3 className="section-title">
        Recently Added
      </h3>

      <div className="poster-row">

        {latest.map((item)=>(

          <div
            key={item.id}
            className="poster-card"
          >

            <img
              src={`${API_URL}${item.poster}`}
              alt={item.name}
            />

            <div className="poster-overlay">

              <span className="type-badge">
                {item.type}
              </span>

              <h4>{item.name}</h4>

              <p>{item.year || "—"}</p>

              <button>
                <Play size={16}/>
                Watch
              </button>

            </div>

          </div>

        ))}

      </div>

    </section>
  );
}