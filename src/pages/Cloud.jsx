import "./Cloud.css";

import { Cloud as CloudIcon, ExternalLink } from "lucide-react";

import { services } from "../data/services";

const CATEGORY_LABELS = {
  media: "Media",
  cloud: "Cloud",
  photos: "Photos",
  downloads: "Downloads",
  system: "System",
};

export default function Cloud() {
  const categories = Object.keys(CATEGORY_LABELS)
    .map((key) => ({
      id: key,
      label: CATEGORY_LABELS[key],
      items: services.filter((service) => service.category === key),
    }))
    .filter((category) => category.items.length > 0);

  return (
    <div className="page">
      <div className="page-head fade-up">
        <h1>Cloud Services</h1>
        <p>Everything running on your NAS, one launch pad</p>
      </div>

      {categories.map((category, index) => (
        <section className="cloud-cat fade-up" key={category.id}>
          <div className="cloud-cat-head">
            <CloudIcon size={17} />
            <h2>{category.label}</h2>
            <span>{category.items.length}</span>
          </div>

          <div className="cloud-grid">
            {category.items.map((service) => {
              const Icon = service.icon;

              return (
                <a
                  key={service.id}
                  href={service.url}
                  target="_blank"
                  rel="noreferrer"
                  className="service-tile"
                >
                  <div
                    className="service-tile-icon"
                    style={{ background: service.color }}
                  >
                    <Icon size={24} />
                  </div>

                  <div className="service-tile-info">
                    <h3>{service.name}</h3>
                    <p>{service.description}</p>
                    <span className="tile-open">
                      Open
                      <ExternalLink size={12} />
                    </span>
                  </div>
                </a>
              );
            })}
          </div>
        </section>
      ))}

      <p
        className="fade-up"
        style={{
          color: "var(--text-secondary)",
          fontSize: 13,
          textAlign: "center",
        }}
      >
        {services.length} services registered in{" "}
        <code style={{ color: "white" }}>src/data/services.js</code>
      </p>
    </div>
  );
}
