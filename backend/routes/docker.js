const express = require("express");

const router = express.Router();

const {
  getDocker,
  restartContainer,
  stopContainer,
  startContainer,
  getContainerLogs,
  getContainerStats,
  getContainerInspect,
  getAllContainerStats,
} = require("../controllers/dockerController");
const { requireAuth } = require("../middleware/requireAuth");

router.get("/", getDocker);

router.get("/logs/:id", getContainerLogs);

// Docker Manager 2.0 enrichment — session-authenticated.
router.get("/stats", requireAuth, getAllContainerStats);
router.get("/stats/:id", requireAuth, getContainerStats);
router.get("/inspect/:id", requireAuth, getContainerInspect);

router.post("/restart/:id", restartContainer);

router.post("/stop/:id", stopContainer);

router.post("/start/:id", startContainer);

module.exports = router;