import {
  Boxes,
  Clapperboard,
  Download,
  Home,
  Search,
  Server,
} from "lucide-react";
import { NavLink } from "react-router-dom";

/**
 * Mobile bottom navigation — five core destinations only. Everything else
 * stays reachable through the sidebar drawer. Touch-sized, label + icon.
 */
const ITEMS = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/search", label: "Search", icon: Search },
  { to: "/media", label: "Media", icon: Clapperboard },
  { to: "/downloads", label: "Downloads", icon: Download },
  { to: "/docker", label: "Docker", icon: Boxes },
  { to: "/system", label: "System", icon: Server },
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
          <item.icon size={21} />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
