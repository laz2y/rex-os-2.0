import "./HeroBanner.css";

import { Play, Info } from "lucide-react";

export default function HeroBanner({ item }) {
  if (!item) return null;

  return (
    <div
      className="hero-banner"
      style={{
        backgroundImage: `linear-gradient(
          rgba(0,0,0,.2),
          rgba(11,13,18,.95)
        ), url(${item.backdrop})`,
      }}
    >
      <div className="hero-content">

        <span className="hero-badge">
          Recently Added
        </span>

        <h1>{item.name}</h1>

        <p>
          {item.year || "—"} • {item.type}
        </p>

        <div className="hero-buttons">

          <button className="watch-btn">
            <Play size={18}/>
            Watch
          </button>

          <button className="info-btn">
            <Info size={18}/>
            Details
          </button>

        </div>

      </div>
    </div>
  );
}