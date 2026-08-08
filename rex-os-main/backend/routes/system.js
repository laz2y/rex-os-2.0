const express = require("express");

const router = express.Router();

const {
  getSystem,
} = require("../controllers/systemController");

router.get("/", getSystem);

module.exports = router;