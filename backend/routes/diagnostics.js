const express = require("express");

const router = express.Router();

const { getDiagnostics } = require("../controllers/diagnosticsController");

router.get("/", getDiagnostics);

module.exports = router;
