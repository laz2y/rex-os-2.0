import "./Settings.css";

import { useCallback, useEffect, useState } from "react";
import {
  Boxes,
  Camera,
  Check,
  Cloud as CloudIcon,
  Download,
  Film,
  PackageOpen,
  Palette,
  RefreshCw,
  ShieldCheck,
  Zap,
} from "lucide-react";

import { useTheme } from "../hooks/useTheme";
import { resolveArtwork } from "../core/themes/artwork";
import { config } from "../data/config";
import { getConnections, testConnection } from "../api/connections";

/** Converts a hex accent to an "r, g, b" string for rgba() usage in CSS vars. */
function hexToRgb(hex) {
  const value = parseInt(hex.replace("#", ""), 16);
  return `${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}`;
}

const CONNECTIONS = [
  { id: "jellyfin", name: "Jellyfin", description: "Media server", icon: Film },
  {
    id: "nextcloud",
    name: "Nextcloud",
    description: "Cloud storage",
    icon: CloudIcon,
  },
  { id: "immich", name: "Immich", description: "Photo library", icon: Camera },
  {
    id: "portainer",
    name: "Portainer",
    description: "Docker / containers",
    icon: Boxes,
  },
  { id: "qbittorrent", name: "qBittorrent", description: "Downloads", icon: Download },
  {
    id: "pyload",
    name: "pyLoad",
    description: "Direct link downloads",
    icon: PackageOpen,
  },
];

const IDLE = { state: "checking", detail: "Checking…", ms: null };

function idleStates() {
  return Object.fromEntries(CONNECTIONS.map((conn) => [conn.id, { ...IDLE }]));
}

const STATE_LABEL = {
  checking: "Checking…",
  connected: "Connected",
  offline: "Offline",
  error: "Error",
};

/** Theme card thumbnail — resolves to the real artwork (upload or fallback). */
function ArtworkThumb({ option }) {
  const [src, setSrc] = useState(option.artwork || null);

  useEffect(() => {
    let active = true;
    resolveArtwork(option.id).then((url) => {
      if (active && url) setSrc(url);
    });
    return () => {
      active = false;
    };
  }, [option.id]);

  return (
    <div
      className="theme-art"
      style={
        src
          ? {
              backgroundImage: `linear-gradient(rgba(0,0,0,.25), rgba(0,0,0,.25)), url(${src})`,
            }
          : { background: "var(--theme-fallback)" }
      }
    >
      <span className="preview-pill">Preview</span>
      <span className="check">
        <Check size={16} />
      </span>
    </div>
  );
}

export default function Settings() {
  const { theme, themes, setTheme } = useTheme();
  const [statuses, setStatuses] = useState(idleStates);
  const [testing, setTesting] = useState({});

  // Live background preview: swap the artwork slot while hovering a card.
  const previewTheme = useCallback((option) => {
    resolveArtwork(option.id).then((url) => {
      document.documentElement.style.setProperty(
        "--theme-bg-image",
        url ? `url("${url}")` : "none",
      );
    });
  }, []);

  const clearPreview = useCallback(() => {
    resolveArtwork(theme.id).then((url) => {
      document.documentElement.style.setProperty(
        "--theme-bg-image",
        url ? `url("${url}")` : "none",
      );
    });
  }, [theme.id]);

  // Never leave a hover preview behind after leaving the page.
  useEffect(
    () => () =>
      document.documentElement.style.removeProperty("--theme-bg-image"),
    [],
  );

  /** Load every service status through the Express backend (server-side probes). */
  const refreshAll = useCallback(async () => {
    setStatuses(idleStates());

    try {
      const data = await getConnections();

      setStatuses(
        Object.fromEntries(
          Object.entries(data.services || {}).map(([id, result]) => [
            id,
            {
              state: result.status || "error",
              detail: result.detail || "—",
              ms: result.ms ?? null,
            },
          ]),
        ),
      );
    } catch {
      // The REX API itself is unreachable — nothing can be tested.
      setStatuses(
        Object.fromEntries(
          CONNECTIONS.map((conn) => [
            conn.id,
            { state: "offline", detail: "REX API unreachable", ms: null },
          ]),
        ),
      );
    }
  }, []);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  /** Test a single service — the probe runs server-side, never in the browser. */
  const runTest = useCallback(async (id) => {
    setTesting((prev) => ({ ...prev, [id]: true }));
    setStatuses((prev) => ({
      ...prev,
      [id]: { state: "checking", detail: "Testing…", ms: null },
    }));

    try {
      const result = await testConnection(id);
      setStatuses((prev) => ({
        ...prev,
        [id]: {
          state: result.status || "error",
          detail: result.detail || "—",
          ms: result.ms ?? null,
        },
      }));
    } catch {
      setStatuses((prev) => ({
        ...prev,
        [id]: { state: "offline", detail: "REX API unreachable", ms: null },
      }));
    } finally {
      setTesting((prev) => ({ ...prev, [id]: false }));
    }
  }, []);

  return (
    <div className="page">
      <div className="page-head fade-up">
        <h1>Settings</h1>
        <p>Themes, connections and system info</p>
      </div>

      <section className="settings-section fade-up">
        <h2>
          <Palette size={18} /> Anime Themes
        </h2>          <p>
            Pick an atmosphere — hover a card to preview its background. The
            theme wallpapers live in{" "}
            <code style={{ color: "white" }}>public/assets/</code>{" "}
            (<code style={{ color: "white" }}>goku.png</code>,{" "}
            <code style={{ color: "white" }}>luffy.png</code>,{" "}
            <code style={{ color: "white" }}>naruto.png</code>,{" "}
            <code style={{ color: "white" }}>all_three.png</code> for The Trio)
            with <code style={{ color: "white" }}>background.png</code> reserved
            for the Login screen and{" "}
            <code style={{ color: "white" }}>banner.png</code> for the Home
            hero — replace a file and refresh to swap the artwork.
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
              <ArtworkThumb option={option} />

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
        <div className="conn-head">
          <div>
            <h2>Connections</h2>
            <p>
              Jellyfin, Nextcloud, Immich, Portainer, qBittorrent and pyLoad.
              Every check runs through the REX API — credentials stay
              server-side.
            </p>
          </div>

          <button type="button" className="refresh-btn" onClick={refreshAll}>
            <RefreshCw size={15} />
            Re-check all
          </button>
        </div>

        <div className="conn-list">
          {CONNECTIONS.map((conn) => {
            const status = statuses[conn.id] || IDLE;
            const Icon = conn.icon;
            const isTesting = testing[conn.id];

            return (
              <div className="conn-row" key={conn.id}>
                <div className="conn-icon">
                  <Icon size={20} />
                </div>

                <div className="conn-info">
                  <h4>{conn.name}</h4>
                  <span>{conn.description}</span>
                </div>

                {status.detail && (
                  <span className="conn-detail" title={status.detail}>
                    {status.detail}
                  </span>
                )}

                <span className={`conn-state ${status.state}`}>
                  <span
                    className={`foot-dot ${
                      status.state === "connected"
                        ? "ok"
                        : status.state === "offline"
                        ? "warn"
                        : status.state === "error"
                        ? "bad"
                        : "wait"
                    }`}
                  />
                  {STATE_LABEL[status.state] || status.state}
                </span>

                {status.ms != null && (
                  <span className="conn-ms">{status.ms}ms</span>
                )}

                <button
                  type="button"
                  className="test-btn"
                  onClick={() => runTest(conn.id)}
                  disabled={isTesting || status.state === "checking"}
                >
                  {isTesting ? (
                    <RefreshCw size={13} className="spin" />
                  ) : (
                    <Zap size={13} />
                  )}
                  {isTesting ? "Testing…" : "Test Connection"}
                </button>
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
