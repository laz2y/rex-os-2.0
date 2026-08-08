export default function StatCard({
  title,
  value,
  color,
}) {
  return (
    <div className="stat-card">

      <div
        className="stat-bar"
        style={{
          background: color,
        }}
      />

      <div className="stat-info">

        <span>{title}</span>

        <h2>{value}</h2>

      </div>

    </div>
  );
}