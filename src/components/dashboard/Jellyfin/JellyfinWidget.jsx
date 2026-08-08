import "./JellyfinWidget.css";

import { useEffect, useState } from "react";
import { Clapperboard, ExternalLink, Play, RefreshCw } from "lucide-react";

import { services } from "../../../data/services";

import {
  getJellyfinServer,
  getLatestMedia,
  mediaUrl,
} from "../../../services/jellyfinService";

function PosterSkeleton() {
  return <div className="skeleton poster-sk" />;
}

export default function JellyfinWidget() {
  const [server, setServer] = useState(null);
  const [latest, setLatest] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const jellyfin = services.find((service) => service.id === "jellyfin");

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const [info, media] = await Promise.all([
          getJellyfinServer(),
          getLatestMedia(),
        ]);

        if (!active) return;

        setServer(info);
        setLatest(media);
      } catch (err) {
        console.error("[REX OS] Jellyfin load failed:", err);

        if (active) setError(err);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <section className="jellyfin-widget fade-up" aria-busy="true">
        <div className="jellyfin-header">
          <div className="skeleton sk-title-w" />
        </div>
        <div className="poster-row">
          <PosterSkeleton />
          <PosterSkeleton />
          <PosterSkeleton />
          <PosterSkeleton />
          <PosterSkeleton />
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="jellyfin-widget fade-up">
        <div className="error-card">
          <div className="error-icon">
            <Clapperboard size={22} />
          </div>

          <div className="error-body">
            <h3>Jellyfin is unreachable</h3>
            <p>
              Could not reach the Jellyfin server. Check that it is running and
              the API key is configured, then try again.
            </p>
          </div>

          <button
            type="button"
            className="retry-btn"
            onClick={() => window.location.reload()}
          >
            <RefreshCw size={16} />
            Retry
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="jellyfin-widget fade-up">
      <div className="jellyfin-header">
        <div>
          <h2>
            <Clapperboard size={24} />
            Jellyfin
          </h2>
          <p>
            {server?.serverName || "Media server"} • {server?.version || "—"}
          </p>
        </div>

        {jellyfin && (
          <a
            className="widget-link"
            href={jellyfin.url}
            target="_blank"
            rel="noreferrer"
          >
            Open Jellyfin
            <ExternalLink size={15} />
          </a>
        )}
      </div>

      <h3 className="section-title">Recently Added</h3>

      {latest.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <Clapperboard size={24} />
          </div>
          <h4>Your library is empty</h4>
          <p>
            Add media to Jellyfin and it will show up here as it is scanned.
          </p>
        </div>
      ) : (
        <div className="poster-row">
          {latest.map((item) => (
            <div key={item.id} className="poster-card">
              <img src={mediaUrl(item.poster)} alt={item.name} />

              <div className="poster-overlay">
                <span className="type-badge">{item.type}</span>
                <h4>{item.name}</h4>
                <p>{item.year || "—"}</p>

                <a
                  className="watch-link"
                  href={`${jellyfin?.url || ""}/web/index.html#!/details?id=${item.id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Play size={16} />
                  Watch
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
