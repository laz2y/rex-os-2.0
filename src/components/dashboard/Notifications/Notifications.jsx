import "./Notifications.css";

import { useEffect, useState } from "react";
import { RefreshCw, Tv } from "lucide-react";

import { getSessions, mediaUrl } from "../../../services/jellyfinService";

function RowSkeleton() {
  return (
    <div className="notif-item">
      <div className="skeleton notif-avatar" />
      <div className="notif-info">
        <div className="skeleton sk-title-sm" />
        <div className="skeleton sk-sub-sm" />
      </div>
    </div>
  );
}

export default function Notifications() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const data = await getSessions();

        if (active) {
          setSessions(data);
          setError(null);
        }
      } catch (err) {
        console.error("[REX OS] sessions poll failed:", err);

        if (active) setError(err);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    const interval = setInterval(load, 30000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <section className="notifications fade-up">
      <div className="notif-header">
        <h2>Now Playing</h2>
        {sessions.length > 0 && <span className="notif-count">{sessions.length}</span>}
      </div>

      {loading ? (
        <div className="notif-list" aria-busy="true">
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </div>
      ) : error ? (
        <div className="notif-error">
          <RefreshCw size={15} />
          <span>Could not reach Jellyfin sessions</span>
        </div>
      ) : sessions.length === 0 ? (
        <div className="notif-empty">
          <Tv size={20} />
          <p>Nothing is playing right now.</p>
        </div>
      ) : (
        <div className="notif-list">
          {sessions.map((session) => (
            <div className="notif-item" key={session.id}>
              <div className="notif-avatar">
                <img
                  src={mediaUrl(session.item.poster)}
                  alt=""
                  loading="lazy"
                />
              </div>

              <div className="notif-info">
                <h4>{session.item.name}</h4>
                <span>
                  {session.user} • {session.client}
                </span>
              </div>

              <span className="live-badge">
                {session.remote ? "LIVE" : "PAUSED"}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
