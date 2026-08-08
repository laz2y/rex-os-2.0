import "./Header.css";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  CalendarDays,
  Clock3,
  Menu,
  Search,
} from "lucide-react";

import useLiveClock from "../../../hooks/useLiveClock";
import { config } from "../../../data/config";

export default function Header({ onMenu }) {
  const { time, date } = useLiveClock();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  function handleSearch(event) {
    event.preventDefault();

    const term = query.trim();

    navigate(term ? `/media?q=${encodeURIComponent(term)}` : "/media");
  }

  return (
    <header className="header">
      <div className="header-left">
        <button
          type="button"
          className="menu-btn"
          onClick={onMenu}
          aria-label="Open navigation"
        >
          <Menu size={22} />
        </button>

        <div className="header-meta">
          <span className="header-brand">
            {config.appName} <b>v{config.version}</b>
          </span>

          <div className="header-date">
            <CalendarDays size={16} />
            <span>{date}</span>
          </div>
        </div>
      </div>

      <div className="header-right">
        <div className="header-clock">
          <Clock3 size={16} />
          {time}
        </div>

        <form className="search-box" onSubmit={handleSearch}>
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search the library…"
            aria-label="Search the library"
          />
        </form>

        <button
          type="button"
          className="notify"
          onClick={() => navigate("/media")}
          aria-label="Browse media"
        >
          <Bell size={18} />
          <span className="notify-dot" />
        </button>
      </div>
    </header>
  );
}
