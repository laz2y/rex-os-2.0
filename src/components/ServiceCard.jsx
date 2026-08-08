export default function ServiceCard({ service }) {
  return (
    <a
      href={service.url}
      target="_blank"
      rel="noreferrer"
      className="service-card"
    >
      <div
        className="service-icon"
        style={{
          background: service.color,
        }}
      >
        {service.icon}
      </div>

      <div className="service-info">
        <h3>{service.name}</h3>
        <p>{service.description}</p>

        <span
          className={
            service.status === "online"
              ? "status online"
              : "status offline"
          }
        >
          {service.status}
        </span>
      </div>
    </a>
  );
}