import "./HomeHero.css";

import { useEffect, useState } from "react";

import { config } from "../../../data/config";
import { setSlotArtwork } from "../../../core/themes/artwork";

/**
 * Wide premium banner at the very top of the Home page. The backdrop is the
 * dedicated `banner` artwork (public/themes/banner/background.* — blurred +
 * darkened for readability); when no banner image has been uploaded it falls
 * back to the active theme's artwork so the hero always follows the theme.
 */
export default function HomeHero() {
  // Fades in the dedicated banner artwork once it resolves (avoids a flash
  // of the theme fallback when a banner upload exists).
  const [hasBanner, setHasBanner] = useState(false);

  useEffect(() => {
    let active = true;
    setSlotArtwork("banner", "--banner-bg-image").then((url) => {
      if (active) setHasBanner(Boolean(url));
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="home-hero fade-up">
      <div
        className={`home-hero-bg ${hasBanner ? "has-banner" : ""}`}
        aria-hidden="true"
      />
      <div className="home-hero-shade" aria-hidden="true" />

      <div className="home-hero-content">
        <span className="home-hero-eyebrow">
          {config.appName} · NAS CONTROL CENTER
        </span>
        <h2>
          One Dream. <em>One Will.</em> One Power.
        </h2>
        <p>Your Digital World. One Command Center.</p>
      </div>

      <div className="home-hero-emblem" aria-hidden="true">
        <span>⚓</span>
      </div>
    </section>
  );
}
