import "./SectionTitle.css";

export default function SectionTitle({ children, className = "" }) {
  return <h3 className={`section-title ${className}`}>{children}</h3>;
}
