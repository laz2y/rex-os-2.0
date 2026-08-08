import {
  Home,
  Clapperboard,
  Cloud,
  Camera,
  Boxes,
  HardDrive,
} from "lucide-react";

import { NavLink } from "react-router-dom";

export default function Sidebar() {
  return (
    <aside className="sidebar">

      <div className="logo">

        <div className="logo-icon">
          ⚓
        </div>

        <div>
          <h2>REX OS</h2>
          <span>v1.0</span>
        </div>

      </div>

      <nav>

        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            isActive ? "nav-btn active" : "nav-btn"
          }
        >
          <Home size={20} />
          Home
        </NavLink>

        <NavLink
          to="/media"
          className={({ isActive }) =>
            isActive ? "nav-btn active" : "nav-btn"
          }
        >
          <Clapperboard size={20} />
          Media
        </NavLink>

        <NavLink
          to="/cloud"
          className={({ isActive }) =>
            isActive ? "nav-btn active" : "nav-btn"
          }
        >
          <Cloud size={20} />
          Cloud
        </NavLink>

        <NavLink
          to="/docker"
          className={({ isActive }) =>
            isActive ? "nav-btn active" : "nav-btn"
          }
        >
          <Boxes size={20} />
          Docker
        </NavLink>

        <NavLink
          to="/photos"
          className={({ isActive }) =>
            isActive ? "nav-btn active" : "nav-btn"
          }
        >
          <Camera size={20} />
          Photos
        </NavLink>

        <NavLink
          to="/system"
          className={({ isActive }) =>
            isActive ? "nav-btn active" : "nav-btn"
          }
        >
          <HardDrive size={20} />
          System
        </NavLink>

      </nav>

    </aside>
  );
}