const express = require("express");

const router = express.Router();

const { getSystem, getSystemMetrics } = require("../controllers/systemController");
const {
  getConnections,
  testConnection,
} = require("../controllers/connectionsController");
const { requireAuth } = require("../middleware/requireAuth");

router.get("/", getSystem);

// Full real-time monitoring payload — session-authenticated.
router.get("/metrics", requireAuth, getSystemMetrics);

// Service connection status + per-service tests (server-side only)
router.get("/connections", getConnections);
router.post("/connections/:id/test", testConnection);

module.exports = router;