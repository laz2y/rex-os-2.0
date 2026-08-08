import "./Card.css";

export default function Card({ title, subtitle, children, className = "" }) {
  return (
    <section className={`ui-card ${className}`}>
      {(title || subtitle) && (
        <div className="ui-card-head">
          {title && <h3>{title}</h3>}
          {subtitle && <p>{subtitle}</p>}
        </div>
      )}
      {children}
    </section>
  );
}
