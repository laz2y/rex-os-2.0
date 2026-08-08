import "./Header.css";
import {
  Search,
  Bell,
  CalendarDays,
  Clock3,
} from "lucide-react";

export default function Header() {
  const now = new Date();

  const greeting =
    now.getHours() < 12
      ? "Good Morning"
      : now.getHours() < 18
      ? "Good Afternoon"
      : "Good Evening";

  return (
    <header className="header">

      <div className="header-left">

        <h1>
          {greeting}, Ak 👋
        </h1>

        <div className="header-date">

          <CalendarDays size={16} />

          <span>
            {now.toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </span>

        </div>

      </div>

      <div className="header-right">

        <div className="header-clock">

          <Clock3 size={16} />

          {now.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}

        </div>

        <div className="search-box">

          <Search size={18} />

          <input
            placeholder="Search REX OS..."
          />

        </div>

        <button className="notify">

          <Bell size={18} />

        </button>

      </div>

    </header>
  );
}