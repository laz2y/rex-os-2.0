const portainer = require("../services/portainerService");

exports.getDocker = async (req, res) => {
  try {
    const containers = await portainer.getContainers();

    const running = containers.filter(
      (container) => container.State === "running"
    ).length;

    const stopped = containers.filter(
      (container) => container.State !== "running"
    ).length;

    res.json({
      status: "success",
      running,
      stopped,
      containers: containers.map((container) => ({
        id: container.Id,
        name: container.Names[0].replace("/", ""),
        image: container.Image,
        state: container.State,
        status: container.Status,
      })),
    });
  } catch (error) {
    console.error(error.response?.data || error.message);

    res.status(500).json({
      status: "error",
      message: "Failed to communicate with Portainer.",
      details: error.response?.data || error.message,
    });
  }
};

exports.restartContainer = async (req, res) => {
  try {
    await portainer.restartContainer(req.params.id);

    res.json({
      status: "success",
      message: "Container restarted successfully.",
    });
  } catch (error) {
    console.error(error.response?.data || error.message);

    res.status(500).json({
      status: "error",
      message: "Failed to restart container.",
      details: error.response?.data || error.message,
    });
  }
};

exports.stopContainer = async (req, res) => {
  try {
    await portainer.stopContainer(req.params.id);

    res.json({
      status: "success",
      message: "Container stopped successfully.",
    });
  } catch (error) {
    console.error(error.response?.data || error.message);

    res.status(500).json({
      status: "error",
      message: "Failed to stop container.",
      details: error.response?.data || error.message,
    });
  }
};

exports.startContainer = async (req, res) => {
  try {
    await portainer.startContainer(req.params.id);

    res.json({
      status: "success",
      message: "Container started successfully.",
    });
  } catch (error) {
    console.error(error.response?.data || error.message);

    res.status(500).json({
      status: "error",
      message: "Failed to start container.",
      details: error.response?.data || error.message,
    });
  }
};

exports.getContainerLogs = async (req, res) => {
  try {
    const logs = await portainer.getLogs(req.params.id);

    res.type("text/plain").send(logs);
  } catch (error) {
    console.error(error.response?.data || error.message);

    res.status(500).json({
      status: "error",
      message: "Failed to fetch container logs.",
      details: error.response?.data || error.message,
    });
  }
};