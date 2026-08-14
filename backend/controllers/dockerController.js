const dockerManager = require("../services/dockerManagerService");
const portainer = require("../services/portainerService");
const activity = require("../services/activityService");

exports.getDocker = async (req, res) => {
  try {
    const containers = await dockerManager.getContainers();

    const running = containers.filter(
      (container) => container.state === "running"
    ).length;

    const stopped = containers.length - running;

    // Additive: legacy fields (id/name/image/state/status) preserved, plus
    // shortId, health, created, ports for Docker Manager 2.0.
    res.json({
      status: "success",
      running,
      stopped,
      containers,
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

exports.getAllContainerStats = async (req, res) => {
  try {
    const stats = await dockerManager.getAllContainerStats();
    res.json({ status: "success", stats });
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch container stats.",
      details: error.response?.data || error.message,
    });
  }
};

exports.getContainerStats = async (req, res) => {
  try {
    const stats = await dockerManager.getContainerStats(req.params.id);
    res.json({ status: "success", id: req.params.id, stats });
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch container stats.",
      details: error.response?.data || error.message,
    });
  }
};

exports.getContainerInspect = async (req, res) => {
  try {
    const inspect = await dockerManager.getContainerInspect(req.params.id);
    res.json({ status: "success", id: req.params.id, inspect });
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({
      status: "error",
      message: "Failed to inspect container.",
      details: error.response?.data || error.message,
    });
  }
};

exports.restartContainer = async (req, res) => {
  const id = req.params.id;
  try {
    await portainer.restartContainer(id);

    activity.record({
      type: "docker",
      service: "docker",
      action: "restart_container",
      result: "success",
      message: `Restarted container ${id}`,
      severity: "info",
    });

    res.json({
      status: "success",
      message: "Container restarted successfully.",
    });
  } catch (error) {
    console.error(error.response?.data || error.message);

    activity.record({
      type: "docker",
      service: "docker",
      action: "restart_container",
      result: "error",
      message: `Failed to restart container ${id}`,
      severity: "error",
    });

    res.status(500).json({
      status: "error",
      message: "Failed to restart container.",
      details: error.response?.data || error.message,
    });
  }
};

exports.stopContainer = async (req, res) => {
  const id = req.params.id;
  try {
    await portainer.stopContainer(id);

    activity.record({
      type: "docker",
      service: "docker",
      action: "stop_container",
      result: "success",
      message: `Stopped container ${id}`,
      severity: "warning",
    });

    res.json({
      status: "success",
      message: "Container stopped successfully.",
    });
  } catch (error) {
    console.error(error.response?.data || error.message);

    activity.record({
      type: "docker",
      service: "docker",
      action: "stop_container",
      result: "error",
      message: `Failed to stop container ${id}`,
      severity: "error",
    });

    res.status(500).json({
      status: "error",
      message: "Failed to stop container.",
      details: error.response?.data || error.message,
    });
  }
};

exports.startContainer = async (req, res) => {
  const id = req.params.id;
  try {
    await portainer.startContainer(id);

    activity.record({
      type: "docker",
      service: "docker",
      action: "start_container",
      result: "success",
      message: `Started container ${id}`,
      severity: "info",
    });

    res.json({
      status: "success",
      message: "Container started successfully.",
    });
  } catch (error) {
    console.error(error.response?.data || error.message);

    activity.record({
      type: "docker",
      service: "docker",
      action: "start_container",
      result: "error",
      message: `Failed to start container ${id}`,
      severity: "error",
    });

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