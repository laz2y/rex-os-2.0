export default function Header() {
  return (
    <header className="header">

      <div>
        <h1>Good Afternoon, Ak 👋</h1>
        <p>Everything is running perfectly.</p>
      </div>

      <div className="header-right">

        <input
          placeholder="Search..."
          className="search"
        />

        <button className="icon">🔔</button>

        <button className="icon">⚙️</button>

        <img
          className="avatar"
          src="https://i.pravatar.cc/100"
          alt=""
        />

      </div>

    </header>
  );
}