import {
  Activity as ActivityIcon,
  Archive,
  Bell,
  Boxes,
  Camera,
  ChevronRight,
  Clapperboard,
  Cloud,
  Download,
  ExternalLink,
  HardDrive,
  Home,
  LifeBuoy,
  Link2,
  LogOut,
  PackageCheck,
  Server,
  Settings,
  Stethoscope,
  Workflow,
} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";

import { useTheme } from "../hooks/useTheme";
import { useAuth } from "../hooks/useAuth";
import { config } from "../data/config";

const NAV = [
  {
    caption: "Dashboard",
    items: [
      { to: "/", label: "Dashboard", icon: Home, end: true },
      { to: "/direct-link", label: "Direct Link", icon: Link2 },
    ],
  },
  {
    caption: "Control",
    items: [
      { to: "/pipeline", label: "Pipeline", icon: Workflow },
      { to: "/diagnostics", label: "Diagnostics", icon: Stethoscope },
      { to: "/activity", label: "Activity", icon: ActivityIcon },
      { to: "/notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    caption: "NAS",
    items: [
      { to: "/system", label: "System", icon: Server },
      { to: "/docker", label: "Docker", icon: Boxes },
      { to: "/storage", label: "Storage", icon: HardDrive },
    ],
  },
  {
    caption: "Media",
    items: [
      { to: "/media", label: "Media Center", icon: Clapperboard },
      { to: "/downloads", label: "Downloads", icon: Download },
      { to: "/photos", label: "Photos", icon: Camera },
      { to: "/cloud", label: "Cloud", icon: Cloud },
    ],
  },
  {
    caption: "System",
    items: [
      { to: "/settings", label: "Settings", icon: Settings },
      {
        // Updates live in the separate REX Updater service — REX OS opens it
        // in a new tab instead of duplicating updater functionality.
        href: config.updaterUrl,
        label: "Updates",
        icon: PackageCheck,
        external: true,
      },
      { to: "/backups", label: "Backups", icon: Archive },
      { to: "/recovery", label: "Recovery", icon: LifeBuoy },
    ],
  },
];

export default function Sidebar({ open, onClose }) {
  const { theme, themes, setTheme } = useTheme();
  const { signOut } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await signOut();
    onClose();
    navigate("/login", { replace: true });
  }

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
          {NAV.map((group) => (
            <div key={group.caption}>
              <p className="nav-caption">{group.caption}</p>

              {group.items.map((item) =>
                item.external ? (
                  <a
                    key={item.label}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className="nav-item"
                    onClick={onClose}
                    title="Opens the REX Updater in a new tab"
                    aria-label={`${item.label} — opens the REX Updater in a new tab`}
                  >
                    <item.icon size={20} />
                    <span>{item.label}</span>
                    <ExternalLink size={14} className="nav-ext" />
                  </a>
                ) : (
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
                ),
              )}
            </div>
          ))}
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

          <button
            type="button"
            className="logout-btn"
            onClick={handleLogout}
            title="Log out"
            aria-label="Log out"
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>
    </>
  );
}
