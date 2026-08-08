import "./App.css";

import {
  LayoutDashboard,
  Clapperboard,
  Cloud,
  Camera,
  Boxes,
  Settings,
  ChevronRight,
} from "lucide-react";

import Home from "./pages/Home";

const menu = [
  { icon: LayoutDashboard, label: "Dashboard", active: true },
  { icon: Clapperboard, label: "Media" },
  { icon: Cloud, label: "Cloud" },
  { icon: Camera, label: "Photos" },
  { icon: Boxes, label: "Docker" },
  { icon: Settings, label: "Settings" },
];

export default function App() {
  return (
    <div className="app">
      <aside className="sidebar">

        <div className="logo">
          <div className="logo-icon">⚓</div>

          <div>
            <h2>REX OS</h2>
            <span>Control Center</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {menu.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.label}
                className={item.active ? "nav-item active" : "nav-item"}
              >
                <Icon size={20} />

                <span>{item.label}</span>

                {item.active && (
                  <ChevronRight
                    size={18}
                    className="nav-arrow"
                  />
                )}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">

          <div className="online"></div>

          <div>
            <strong>NAS Online</strong>

            <p>All systems operational</p>
          </div>

        </div>

      </aside>

      <main className="content">
        <Home />
      </main>
    </div>
  );
}