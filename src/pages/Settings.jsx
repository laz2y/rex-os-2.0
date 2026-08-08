import "./Settings.css";

import { useCallback, useEffect, useState } from "react";
import {
  Boxes,
  Check,
  Cpu,
  Film,
  Palette,
  RefreshCw,
  Server,
  ShieldCheck,
} from "lucide-react";

import { useTheme } from "../hooks/useTheme";
import { getTheme } from "../core/themes/themeManager";
import { config } from "../data/config";
import { API_BASE } from "../api/config";
import { getJellyfinServer } from "../services/jellyfinService";
import apiClient from "../services/apiClient";

/** Converts a hex accent to an "r, g, b" string for rgba() usage in CSS vars. */
function hexToRgb(hex) {
  const value = parseInt(hex.replace("#", ""), 16);
  return `${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}`;
}

const CHECKS = [
  {
    id: "api",
    name: "REX API",
    detail: `${API_BASE}/health`,
    icon: Server,
    probe: () =>
      apiClient.get("/health").then((response) => response.data),
  },
  {
    id: "system",
    name: "System telemetry",
    detail: "CPU, RAM, storage",
    icon: Cpu,
    probe: () => apiClient.get("/system").then((response) => response.data),
  },
  {
    id: "docker",
    name: "Docker / Portainer",
    detail: "Container API",
    icon: Boxes,
    probe: () => apiClient.get("/docker").then((response) => response.data),
  },
  {
    id: "jellyfin",
    name: "Jellyfin",
    detail: "Media server API",
    icon: Film,
    probe: () => getJellyfinServer(),
  },
];

export default function Settings() {
  const { theme, themes, setTheme } = useTheme();
  const [statuses, setStatuses] = useState(
    Object.fromEntries(
      CHECKS.map((check) => [check.id, { state: "wait", ms: null }]),
    ),
  );

  // Live background preview: swap the artwork slot while hovering a card.
  const previewTheme = useCallback((option) => {
    if (!option.artwork) return;
    document.documentElement.style.setProperty(
      "--theme-bg-image",
      `url("${option.artwork}")`,
    );
  }, []);

  const clearPreview = useCallback(() => {
    const active = getTheme(theme.id);
    document.documentElement.style.setProperty(
      "--theme-bg-image",
      active.artwork ? `url("${active.artwork}")` : "none",
    );
  }, [theme.id]);

  // Never leave a hover preview behind after leaving the page.
  useEffect(
    () => () =>
      document.documentElement.style.removeProperty("--theme-bg-image"),
    [],
  );

  const runChecks = useCallback(async () => {
    setStatuses(
      Object.fromEntries(
        CHECKS.map((check) => [check.id, { state: "wait", ms: null }]),
      ),
    );

    await Promise.all(
      CHECKS.map(async (check) => {
        const started = performance.now();

        try {
          await check.probe();
          const ms = Math.round(performance.now() - started);

          setStatuses((prev) => ({
            ...prev,
            [check.id]: { state: "ok", ms },
          }));
        } catch {
          const ms = Math.round(performance.now() - started);

          setStatuses((prev) => ({
            ...prev,
            [check.id]: { state: "fail", ms },
          }));
        }
      }),
    );
  }, []);

  useEffect(() => {
    runChecks();
  }, [runChecks]);

  return (
    <div className="page">
      <div className="page-head fade-up">
        <h1>Settings</h1>
        <p>Themes, connections and system info</p>
      </div>

      <section className="settings-section fade-up">
        <h2>
          <Palette size={18} /> Anime Themes
        </h2>
        <p>
          Pick an atmosphere — hover a card to preview its background. Artwork
          is loaded from{" "}
          <code style={{ color: "white" }}>public/themes/</code> — drop your
          own images over the existing files to personalise each theme.
        </p>

        <div className="theme-grid">
          {themes.map((option, index) => (
            <button
              key={option.id}
              type="button"
              className={`theme-card fade-up d-${index + 1} ${
                theme.id === option.id ? "active" : ""
              }`}
              style={{
                "--theme-accent": option.accent,
                "--theme-accent-rgb": hexToRgb(option.accent),
              }}
              onClick={() => setTheme(option.id)}
              onMouseEnter={() => previewTheme(option)}
              onMouseLeave={clearPreview}
              aria-pressed={theme.id === option.id}
            >
              <div
                className="theme-art"
                style={
                  option.artwork
                    ? {
                        backgroundImage: `linear-gradient(rgba(0,0,0,.25), rgba(0,0,0,.25)), url(${option.artwork})`,
                      }
                    : { background: "var(--theme-fallback)" }
                }
              >
                <span className="preview-pill">Preview</span>
                <span className="check">
                  <Check size={16} />
                </span>
              </div>

              <div className="theme-body">
                <div
                  className="theme-dot-lg"
                  style={{ background: option.accent }}
                />
                <div>
                  <h3>{option.name}</h3>
                  <span>{option.subtitle}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="settings-section fade-up">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <h2>Connections</h2>
            <p>Status of the REX API and its integrations</p>
          </div>

          <button type="button" className="refresh-btn" onClick={runChecks}>
            <RefreshCw size={15} />
            Re-check
          </button>
        </div>

        <div className="conn-list">
          {CHECKS.map((check) => {
            const state = statuses[check.id] || { state: "wait", ms: null };
            const Icon = check.icon;

            return (
              <div className="conn-row" key={check.id}>
                <div className="conn-icon">
                  <Icon size={20} />
                </div>

                <div className="conn-info">
                  <h4>{check.name}</h4>
                  <span>{check.detail}</span>
                </div>

                <span className={`conn-state ${state.state}`}>
                  <span className="foot-dot" />
                  {state.state === "wait"
                    ? "Checking…"
                    : state.state === "ok"
                    ? "Connected"
                    : "Unreachable"}
                </span>

                {state.ms != null && (
                  <span className="conn-ms">{state.ms}ms</span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="settings-section fade-up">
        <h2>
          <ShieldCheck size={18} /> About
        </h2>

        <div className="about-rows">
          <div className="about-row">
            <span>Version</span>
            <strong>v{config.version}</strong>
          </div>
          <div className="about-row">
            <span>Host</span>
            <strong>{config.hostLabel}</strong>
          </div>
          <div className="about-row">
            <span>Repository</span>
            <a href={config.repo} target="_blank" rel="noreferrer">
              github.com/laz2y/rex-os
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
