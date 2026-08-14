const express = require("express");

const router = express.Router();

const {
  getInfo,
  createSession,
  sendInput,
  readOutput,
  interrupt,
  resize,
  closeSession,
} = require("../controllers/terminalController");
const { requireAuth } = require("../middleware/requireAuth");

// Every terminal route is session-authenticated — no public shell, ever.
router.get("/info", requireAuth, getInfo);
router.post("/session", requireAuth, createSession);
router.post("/session/:id/input", requireAuth, sendInput);
router.get("/session/:id/output", requireAuth, readOutput);
router.post("/session/:id/interrupt", requireAuth, interrupt);
router.post("/session/:id/resize", requireAuth, resize);
router.delete("/session/:id", requireAuth, closeSession);

module.exports = router;
