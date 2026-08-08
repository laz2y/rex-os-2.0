import "./BootScreen.css";

import { useEffect, useRef, useState } from "react";

import { config } from "../data/config";

/** Minimum time the animation is on screen before the fade-out starts. */
const DEFAULT_MIN_MS = 1400;
const EXIT_MS = 340;

/**
 * The REX OS boot / welcome animation.
 *
 * variant="boot"    → shown while the app resolves the session (before Login).
 * variant="welcome" → shown right after a successful sign-in, before the
 *                     Dashboard renders, so the dashboard never flashes early.
 *
 * The whole animation is theme-aware: the emblem, rings, glow and progress
 * bar read the active theme's --primary / --glow-rgb tokens, so it matches
 * whichever anime theme is selected.
 */
export default function BootScreen({
  variant = "boot",
  minMs = DEFAULT_MIN_MS,
  onDone,
}) {
  const [leaving, setLeaving] = useState(false);
  const doneRef = useRef(false);

  // Hold the animation for at least `minMs`, then start the fade-out.
  useEffect(() => {
    const timer = setTimeout(() => setLeaving(true), minMs);
    return () => clearTimeout(timer);
  }, [minMs]);

  // After the fade-out finishes, tell the parent it is safe to continue.
  useEffect(() => {
    if (!leaving) return undefined;

    const timer = setTimeout(() => {
      if (!doneRef.current) {
        doneRef.current = true;
        onDone?.();
      }
    }, EXIT_MS);

    return () => clearTimeout(timer);
  }, [leaving, onDone]);

  const subtitle =
    variant === "welcome"
      ? `Welcome, ${config.userName} 👋`
      : "Loading your command center…";

  return (
    <div
      className={`boot-screen ${leaving ? "leaving" : ""}`}
      role="status"
      aria-live="polite"
    >
      <div className="boot-atmo" aria-hidden="true" />

      <div className="boot-center">
        <div className="boot-emblem" aria-hidden="true">
          <span className="boot-ring boot-ring-a" />
          <span className="boot-ring boot-ring-b" />
          <span className="boot-core">⚓</span>
        </div>

        <h1 className="boot-title">
          REX <em>OS</em>
        </h1>
        <p className="boot-tag">One Dream. One Will. One Power.</p>
        <p className="boot-sub">{subtitle}</p>

        <div className="boot-track" aria-hidden="true">
          <div className="boot-fill" />
        </div>
      </div>
    </div>
  );
}
