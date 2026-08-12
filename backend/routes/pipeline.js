const express = require("express");

const router = express.Router();

const { getPipeline } = require("../controllers/pipelineController");

router.get("/", getPipeline);

module.exports = router;
