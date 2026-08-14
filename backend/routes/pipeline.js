const express = require("express");

const router = express.Router();

const {
  getPipeline,
  restartService,
  restartGroup,
  getRecovery,
} = require("../controllers/pipelineController");

router.get("/", getPipeline);
router.get("/recovery", getRecovery);

router.post("/restart/:service", restartService);
router.post("/restart-group", restartGroup);

module.exports = router;
