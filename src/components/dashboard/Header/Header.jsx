import "./Header.css";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CalendarDays, Clock3, Menu } from "lucide-react";

import useLiveClock from "../../../hooks/useLiveClock";
import { config } from "../../../data/config";
import { getNotifications } from "../../../api/notifications";

export default function Header({ onMenu }) {
  const { time, date } = useLiveClock();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);

  // Keep the bell badge in sync with the server-side unread count.
  useEffect(() => {
    let active = true;

    async function refreshUnread() {
      try {
        const data = await getNotifications();
        if (active) setUnread(data.unread || 0);
      } catch {
        /* backend unreachable — keep the last known count */
      }
    }

    refreshUnread();
    const timer = setInterval(() => {
      if (!document.hidden) refreshUnread();
    }, 30000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

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

        <button
          type="button"
          className="notify"
          onClick={() => navigate("/notifications")}
          aria-label="Notifications"
        >
          <Bell size={18} />
          {unread > 0 && (
            <span className="notify-badge">{unread > 99 ? "99+" : unread}</span>
          )}
        </button>
      </div>
    </header>
  );
}
