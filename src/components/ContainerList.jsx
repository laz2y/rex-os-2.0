export default function ContainerList({ containers = [] }) {
  return (
    <div className="container-panel">

      <h2 className="section-title">
        Docker Containers
      </h2>

      {containers.map((container) => (

        <div
          key={container.name}
          className="container-item"
        >

          <div className="dot online" />

          <div className="container-name">

            <strong>{container.name}</strong>

            <span>{container.status}</span>

          </div>

        </div>

      ))}

    </div>
  );
}