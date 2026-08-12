import {
  Boxes,
  Camera,
  Clapperboard,
  Cloud,
  Download,
  HardDrive,
  Home,
  Link2,
  Workflow,
} from "lucide-react";
import { NavLink } from "react-router-dom";

const ITEMS = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/direct-link", label: "Direct Link", icon: Link2 },
  { to: "/downloads", label: "Downloads", icon: Download },
  { to: "/pipeline", label: "Pipeline", icon: Workflow },
  { to: "/media", label: "Media", icon: Clapperboard },
  { to: "/cloud", label: "Cloud", icon: Cloud },
  { to: "/photos", label: "Photos", icon: Camera },
  { to: "/docker", label: "Docker", icon: Boxes },
  { to: "/system", label: "System", icon: HardDrive },
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Primary">
      {ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            isActive ? "bottom-item active" : "bottom-item"
          }
        >
          <item.icon size={20} />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
