import {
  Boxes,
  Camera,
  ChevronRight,
  Clapperboard,
  Cloud,
  HardDrive,
  Home,
  Settings,
} from "lucide-react";
import { NavLink } from "react-router-dom";

import { useTheme } from "../hooks/useTheme";
import { config } from "../data/config";

const NAV = [
  { to: "/", label: "Dashboard", icon: Home, end: true },
  { to: "/media", label: "Media", icon: Clapperboard },
  { to: "/cloud", label: "Cloud", icon: Cloud },
  { to: "/photos", label: "Photos", icon: Camera },
  { to: "/docker", label: "Docker", icon: Boxes },
  { to: "/system", label: "System", icon: HardDrive },
];

export default function Sidebar({ open, onClose }) {
  const { theme, themes, setTheme } = useTheme();

  return (
    <>
      <div
        className={`sidebar-scrim ${open ? "show" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="logo">
          <div className="logo-icon">⚓</div>

          <div>
            <h2>REX OS</h2>
            <span>v{config.version} · {config.hostLabel}</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                isActive ? "nav-item active" : "nav-item"
              }
              onClick={onClose}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
              <ChevronRight size={18} className="nav-arrow" />
            </NavLink>
          ))}

          <p className="nav-caption">Settings</p>

          <NavLink
            to="/settings"
            className={({ isActive }) =>
              isActive ? "nav-item active" : "nav-item"
            }
            onClick={onClose}
          >
            <Settings size={20} />
            <span>Settings</span>
            <ChevronRight size={18} className="nav-arrow" />
          </NavLink>
        </nav>

        <div className="sidebar-bottom">
          <div className="online"></div>

          <div>
            <strong>NAS Online</strong>
            <p>All systems operational</p>
          </div>

          {/* Theme quick-switcher */}
          <div className="theme-dots" title="Theme">
            {themes.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-label={`${t.name} theme`}
                className={`theme-dot ${theme.id === t.id ? "active" : ""}`}
                style={{ background: t.accent }}
                onClick={() => setTheme(t.id)}
              />
            ))}
          </div>
        </div>
      </aside>
    </>
  );
}
