const express = require("express");

const router = express.Router();

const { getOverview } = require("../controllers/radarrController");

router.get("/overview", getOverview);

module.exports = router;
