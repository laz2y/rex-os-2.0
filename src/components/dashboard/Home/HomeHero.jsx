import "./HomeHero.css";

import { config } from "../../../data/config";

/**
 * Wide premium banner at the very top of the Home page. The backdrop is the
 * active theme's artwork (blurred + darkened for readability) so the banner
 * follows the selected theme automatically.
 */
export default function HomeHero() {
  return (
    <section className="home-hero fade-up">
      <div className="home-hero-bg" aria-hidden="true" />
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
