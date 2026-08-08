const express = require("express");

const router = express.Router();

const { getOverview } = require("../controllers/immichController");

router.get("/overview", getOverview);

module.exports = router;
