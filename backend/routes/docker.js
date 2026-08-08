const express = require("express");

const router = express.Router();

const {
  getDocker,
  restartContainer,
  stopContainer,
  startContainer,
  getContainerLogs,
} = require("../controllers/dockerController");

router.get("/", getDocker);

router.get("/logs/:id", getContainerLogs);

router.post("/restart/:id", restartContainer);

router.post("/stop/:id", stopContainer);

router.post("/start/:id", startContainer);

module.exports = router;