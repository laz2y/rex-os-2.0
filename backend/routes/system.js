const express = require("express");

const router = express.Router();

const { getSystem } = require("../controllers/systemController");
const {
  getConnections,
  testConnection,
} = require("../controllers/connectionsController");

router.get("/", getSystem);

// Service connection status + per-service tests (server-side only)
router.get("/connections", getConnections);
router.post("/connections/:id/test", testConnection);

module.exports = router;