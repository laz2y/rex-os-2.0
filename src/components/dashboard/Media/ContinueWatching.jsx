import "./ContinueWatching.css";

import { useEffect, useState } from "react";
import { Bookmark } from "lucide-react";

import { getResumeMedia, mediaUrl } from "../../../services/jellyfinService";

export default function ContinueWatching() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    getResumeMedia()
      .then((data) => {
        if (active) setItems(data);
      })
      .catch(() => {
        /* the main Jellyfin widget surfaces connection errors */
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <section className="continue-watching fade-up" aria-busy="true">
        <div className="skeleton sk-title-w" />
        <div className="poster-row">
          <div className="skeleton poster-sk" />
          <div className="skeleton poster-sk" />
          <div className="skeleton poster-sk" />
        </div>
      </section>
    );
  }

  if (items.length === 0) return null;

  return (
    <section className="continue-watching fade-up">
      <h2 className="section-title">
        <Bookmark size={20} />
        Continue Watching
      </h2>

      <div className="poster-row">
        {items.map((item) => (
          <div key={item.id} className="poster-card">
            <img src={mediaUrl(item.poster)} alt={item.name} loading="lazy" />
            <div className="poster-overlay">
              <span className="type-badge">{item.type}</span>
              <h4>{item.name}</h4>
              <p>{item.year || "—"}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
